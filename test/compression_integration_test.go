package test

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/astercloud/aster/pkg/middleware"
	"github.com/astercloud/aster/pkg/types"
)

// TestSummarizationMiddlewareIntegration 测试 SummarizationMiddleware 集成
func TestSummarizationMiddlewareIntegration(t *testing.T) {
	// 创建中间件
	mw, err := middleware.NewSummarizationMiddleware(&middleware.SummarizationMiddlewareConfig{
		MaxTokensBeforeSummary: 500, // 低阈值便于测试
		MessagesToKeep:         2,
		SummaryPrefix:          "## Previous conversation summary:",
	})
	if err != nil {
		t.Fatalf("Failed to create middleware: %v", err)
	}

	// 创建测试消息（模拟多轮对话）
	messages := []types.Message{
		{
			Role: types.MessageRoleSystem,
			ContentBlocks: []types.ContentBlock{
				&types.TextBlock{Text: "You are a helpful assistant."},
			},
		},
	}

	// 添加多轮对话消息
	for i := 1; i <= 10; i++ {
		messages = append(messages, types.Message{
			Role: types.MessageRoleUser,
			ContentBlocks: []types.ContentBlock{
				&types.TextBlock{Text: fmt.Sprintf("这是第%d轮对话。请详细解释Go语言的context包，包括使用场景和最佳实践。", i)},
			},
		})
		messages = append(messages, types.Message{
			Role: types.MessageRoleAssistant,
			ContentBlocks: []types.ContentBlock{
				&types.TextBlock{Text: fmt.Sprintf("好的，让我详细解释Go语言的context包。第%d轮回复：context包主要用于控制goroutine的生命周期，传递请求范围的数据，以及设置超时和取消操作。常见的使用场景包括HTTP服务器处理请求、数据库操作超时控制等。", i)},
			},
		})
	}

	t.Logf("Initial messages count: %d", len(messages))

	// 创建请求
	req := &middleware.ModelRequest{
		Messages: messages,
	}

	// 执行中间件
	var processedReq *middleware.ModelRequest
	_, err = mw.WrapModelCall(context.Background(), req, func(ctx context.Context, r *middleware.ModelRequest) (*middleware.ModelResponse, error) {
		processedReq = r
		return &middleware.ModelResponse{}, nil
	})
	if err != nil {
		t.Fatalf("WrapModelCall failed: %v", err)
	}

	t.Logf("Processed messages count: %d", len(processedReq.Messages))

	// 验证消息被压缩了
	if len(processedReq.Messages) >= len(messages) {
		t.Errorf("Expected messages to be compressed, got %d -> %d", len(messages), len(processedReq.Messages))
	}

	// 打印处理后的消息
	for i, msg := range processedReq.Messages {
		content := ""
		for _, block := range msg.ContentBlocks {
			if tb, ok := block.(*types.TextBlock); ok {
				content = tb.Text
				if len(content) > 200 {
					content = content[:200] + "..."
				}
			}
		}
		t.Logf("Message %d [%s]: %s", i, msg.Role, content)
	}

	// 验证摘要格式
	foundSummary := false
	for _, msg := range processedReq.Messages {
		for _, block := range msg.ContentBlocks {
			if tb, ok := block.(*types.TextBlock); ok {
				if strings.Contains(tb.Text, "This session is being continued") {
					foundSummary = true
					t.Logf("Found Claude-style summary!")
				}
			}
		}
	}
	if !foundSummary {
		t.Log("Summary not found (may use default prefix)")
	}

	t.Logf("Summarization count: %d", mw.GetSummarizationCount())
}
