package middleware

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/astercloud/aster/pkg/backends"
	"github.com/astercloud/aster/pkg/memory"
)

// ToolResultOptimizerMiddleware 工具结果优化中间件
// 统一处理所有工具返回结果的压缩，替代分散在各处的压缩逻辑
// 参考 deepagents 的 wrap_tool_call 统一拦截模式
type ToolResultOptimizerMiddleware struct {
	*BaseMiddleware
	config     *ToolResultOptimizerConfig
	compressor memory.ObservationCompressor
	backend    backends.BackendProtocol // 用于 evict 模式
}

// ToolResultOptimizerConfig 配置
type ToolResultOptimizerConfig struct {
	// Enabled 是否启用
	Enabled bool

	// MaxTokens 触发压缩的 token 阈值（字符数 = MaxTokens * 4）
	MaxTokens int

	// CompressType 压缩类型: "summary" | "evict"
	// - summary: 使用 ObservationCompressor 智能压缩
	// - evict: 将大结果写入文件，返回文件引用
	CompressType string

	// EvictPath 驱逐文件路径（仅 evict 模式）
	EvictPath string

	// Backend 文件存储后端（仅 evict 模式需要）
	Backend backends.BackendProtocol
}

// NewToolResultOptimizerMiddleware 创建工具结果优化中间件
func NewToolResultOptimizerMiddleware(config *ToolResultOptimizerConfig) *ToolResultOptimizerMiddleware {
	if config == nil {
		config = &ToolResultOptimizerConfig{
			Enabled:      true,
			MaxTokens:    5000,
			CompressType: "summary",
			EvictPath:    "/large_tool_results/",
		}
	}

	if config.MaxTokens <= 0 {
		config.MaxTokens = 5000
	}

	if config.CompressType == "" {
		config.CompressType = "summary"
	}

	if config.EvictPath == "" {
		config.EvictPath = "/large_tool_results/"
	}

	// 创建压缩器
	compressor := memory.NewObservationCompressorWithConfig(&memory.ObservationCompressorConfig{
		MaxSummaryLength:  3000,                 // 压缩后最大长度
		MinCompressLength: config.MaxTokens * 4, // 触发压缩的最小字符数
	})

	return &ToolResultOptimizerMiddleware{
		BaseMiddleware: NewBaseMiddleware("tool_result_optimizer", 30), // 优先级在 filesystem (100) 之前
		config:         config,
		compressor:     compressor,
		backend:        config.Backend,
	}
}

// WrapToolCall 拦截工具调用结果，统一处理压缩
func (m *ToolResultOptimizerMiddleware) WrapToolCall(
	ctx context.Context,
	req *ToolCallRequest,
	handler ToolCallHandler,
) (*ToolCallResponse, error) {
	// 先执行工具
	result, err := handler(ctx, req)
	if err != nil {
		return result, err
	}

	if !m.config.Enabled {
		return result, nil
	}

	// 获取结果内容
	content := resultToString(result.Result)
	charLimit := m.config.MaxTokens * 4 // 1 token ≈ 4 chars

	if len(content) <= charLimit {
		return result, nil
	}

	// 根据压缩类型处理
	switch m.config.CompressType {
	case "evict":
		return m.evictToFile(ctx, req, result, content)
	default: // "summary"
		return m.compressSummary(ctx, req, result, content)
	}
}

// compressSummary 使用 ObservationCompressor 智能压缩
func (m *ToolResultOptimizerMiddleware) compressSummary(
	ctx context.Context,
	req *ToolCallRequest,
	result *ToolCallResponse,
	content string,
) (*ToolCallResponse, error) {
	toolName := req.ToolName

	compressed, err := m.compressor.Compress(ctx, toolName, content)
	if err != nil {
		log.Printf("[ToolResultOptimizer] Compression failed for %s: %v", toolName, err)
		return result, nil // 压缩失败，返回原结果
	}

	originalLen := len(content)
	compressedLen := len(compressed.Summary)
	reduction := float64(originalLen-compressedLen) / float64(originalLen) * 100

	log.Printf("[ToolResultOptimizer] Compressed %s result: %d -> %d chars (%.1f%% reduction)",
		toolName, originalLen, compressedLen, reduction)

	// 更新结果
	result.Result = compressed.Summary
	if result.Metadata == nil {
		result.Metadata = make(map[string]any)
	}
	result.Metadata["compressed"] = true
	result.Metadata["original_length"] = originalLen
	result.Metadata["compression_ratio"] = compressed.CompressionRatio

	return result, nil
}

// evictToFile 将大结果写入文件，返回文件引用
func (m *ToolResultOptimizerMiddleware) evictToFile(
	ctx context.Context,
	req *ToolCallRequest,
	result *ToolCallResponse,
	content string,
) (*ToolCallResponse, error) {
	if m.backend == nil {
		// 没有 backend，回退到 summary 模式
		return m.compressSummary(ctx, req, result, content)
	}

	// 生成文件路径
	filePath := fmt.Sprintf("%s%s_%s.txt", m.config.EvictPath, req.ToolName, req.ToolCallID)

	// 写入文件
	_, err := m.backend.Write(ctx, filePath, content)
	if err != nil {
		log.Printf("[ToolResultOptimizer] Failed to evict to file: %v", err)
		return m.compressSummary(ctx, req, result, content) // 回退到 summary
	}

	// 构建预览
	lines := splitLinesForOptimizer(content, 10)
	preview := ""
	for i, line := range lines {
		if len(line) > 200 {
			line = line[:200] + "..."
		}
		preview += fmt.Sprintf("%d\t%s\n", i+1, line)
	}

	originalLen := len(content)
	evictedContent := fmt.Sprintf(`Tool result was too large (%d chars, ~%d tokens) and has been saved to: %s

Use read_file to access the full content if needed.

Preview (first 10 lines):
%s`, originalLen, originalLen/4, filePath, preview)

	log.Printf("[ToolResultOptimizer] Evicted %s result to %s (%d chars)",
		req.ToolName, filePath, originalLen)

	result.Result = evictedContent
	if result.Metadata == nil {
		result.Metadata = make(map[string]any)
	}
	result.Metadata["evicted"] = true
	result.Metadata["evicted_path"] = filePath
	result.Metadata["original_length"] = originalLen

	return result, nil
}

// splitLinesForOptimizer 分割字符串为行（避免与 filesystem.go 中的同名函数冲突）
func splitLinesForOptimizer(s string, limit int) []string {
	lines := strings.Split(s, "\n")
	if len(lines) > limit {
		return lines[:limit]
	}
	return lines
}

// resultToString 将工具结果转换为字符串
func resultToString(result any) string {
	if result == nil {
		return ""
	}
	switch v := result.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// GetStats 获取统计信息
func (m *ToolResultOptimizerMiddleware) GetStats() map[string]any {
	return map[string]any{
		"enabled":       m.config.Enabled,
		"max_tokens":    m.config.MaxTokens,
		"compress_type": m.config.CompressType,
	}
}
