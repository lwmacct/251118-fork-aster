package types

// TokenOptimizationConfig Token 优化配置
// 统一管理所有 token 消耗相关的优化选项
type TokenOptimizationConfig struct {
	// Enabled 总开关
	Enabled bool `json:"enabled"`

	// ToolResult 工具结果优化配置
	ToolResult ToolResultOptConfig `json:"tool_result"`

	// Conversation 消息历史压缩配置
	Conversation ConversationOptConfig `json:"conversation"`

	// Prompt System Prompt 优化配置
	Prompt PromptOptConfig `json:"prompt"`
}

// ToolResultOptConfig 工具结果优化配置
type ToolResultOptConfig struct {
	// Enabled 是否启用工具结果压缩
	Enabled bool `json:"enabled"`

	// MaxTokens 触发压缩的 token 阈值（默认 5000）
	MaxTokens int `json:"max_tokens"`

	// CompressType 压缩类型: "summary" (智能摘要) | "evict" (驱逐到文件)
	CompressType string `json:"compress_type"`

	// EvictPath 驱逐文件的存储路径（仅 CompressType="evict" 时生效）
	EvictPath string `json:"evict_path"`
}

// ConversationOptConfig 消息历史压缩配置
type ConversationOptConfig struct {
	// Enabled 是否启用消息历史压缩
	Enabled bool `json:"enabled"`

	// MaxTokens 触发压缩的 token 阈值（默认 50000）
	MaxTokens int `json:"max_tokens"`

	// MessagesToKeep 压缩后保留的最近消息数（默认 6）
	MessagesToKeep int `json:"messages_to_keep"`
}

// PromptOptConfig System Prompt 优化配置
type PromptOptConfig struct {
	// DisableVerboseModules 禁用冗长的 PromptModule
	DisableVerboseModules bool `json:"disable_verbose_modules"`

	// EnableCaching 启用 Prompt Caching（Anthropic）
	EnableCaching bool `json:"enable_caching"`
}

// DefaultTokenOptimizationConfig 返回默认的优化配置
func DefaultTokenOptimizationConfig() *TokenOptimizationConfig {
	return &TokenOptimizationConfig{
		Enabled: true,
		ToolResult: ToolResultOptConfig{
			Enabled:      true,
			MaxTokens:    5000,
			CompressType: "summary",
			EvictPath:    "/large_tool_results/",
		},
		Conversation: ConversationOptConfig{
			Enabled:        true,
			MaxTokens:      50000,
			MessagesToKeep: 6,
		},
		Prompt: PromptOptConfig{
			DisableVerboseModules: true,
			EnableCaching:         true,
		},
	}
}
