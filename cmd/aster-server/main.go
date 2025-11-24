package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/astercloud/aster/pkg/agent"
	"github.com/astercloud/aster/pkg/provider"
	"github.com/astercloud/aster/pkg/router"
	"github.com/astercloud/aster/pkg/sandbox"
	"github.com/astercloud/aster/pkg/store"
	"github.com/astercloud/aster/pkg/tools"
	"github.com/astercloud/aster/pkg/tools/builtin"
	"github.com/astercloud/aster/pkg/types"
	"github.com/astercloud/aster/server"
)

func main() {
	fmt.Println("🚀 aster 星尘云枢 Production Server")
	fmt.Println("================================")

	// Initialize store
	st, err := store.NewJSONStore(".data")
	if err != nil {
		log.Fatalf("Failed to create store: %v", err)
	}

	// Initialize tool registry
	toolRegistry := tools.NewRegistry()
	builtin.RegisterAll(toolRegistry)

	// Initialize factories
	sandboxFactory := sandbox.NewFactory()
	providerFactory := provider.NewMultiProviderFactory()

	// Initialize template registry
	templateRegistry := agent.NewTemplateRegistry()
	
	// Register builtin templates
	registerDefaultTemplates(templateRegistry)

	// Initialize router with environment-based configuration
	provider := os.Getenv("PROVIDER")
	if provider == "" {
		provider = "anthropic"
	}
	model := os.Getenv("MODEL")
	if model == "" {
		if provider == "deepseek" {
			model = "deepseek-chat"
		} else {
			model = "claude-sonnet-4-5"
		}
	}
	
	var apiKey string
	switch provider {
	case "deepseek":
		apiKey = os.Getenv("DEEPSEEK_API_KEY")
	case "anthropic":
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	case "openai":
		apiKey = os.Getenv("OPENAI_API_KEY")
	default:
		apiKey = os.Getenv(provider + "_API_KEY")
	}
	
	defaultModel := &types.ModelConfig{
		Provider: provider,
		Model:    model,
		APIKey:   apiKey,
	}
	routes := []router.StaticRouteEntry{
		{Task: "chat", Priority: router.PriorityQuality, Model: defaultModel},
	}
	rt := router.NewStaticRouter(defaultModel, routes)

	// Create prompt compressor for context compression
	// 需要先创建一个 Provider 用于 LLM 压缩
	compressionProvider, err := providerFactory.Create(&types.ModelConfig{
		Provider: provider,
		Model:    model,
		APIKey:   apiKey,
	})
	if err != nil {
		log.Printf("Warning: Failed to create compression provider: %v (compression will be disabled)", err)
	}
	var promptCompressor *agent.EnhancedPromptCompressor
	if compressionProvider != nil {
		promptCompressor = agent.NewEnhancedPromptCompressor(compressionProvider, "zh")
		fmt.Println("✅ Prompt compressor initialized")
	}

	// Create agent dependencies
	agentDeps := &agent.Dependencies{
		Store:            st,
		ToolRegistry:     toolRegistry,
		SandboxFactory:   sandboxFactory,
		ProviderFactory:  providerFactory,
		TemplateRegistry: templateRegistry,
		Router:           rt,
		PromptCompressor: promptCompressor,
	}

	// Create server dependencies
	deps := &server.Dependencies{
		Store:     st,
		AgentDeps: agentDeps,
	}

	// Load configuration (use default for now)
	config := server.DefaultConfig()

	// Override with environment variables if needed
	if port := os.Getenv("PORT"); port != "" {
		_, _ = fmt.Sscanf(port, "%d", &config.Port)
	}
	if host := os.Getenv("HOST"); host != "" {
		config.Host = host
	}
	if apiKey := os.Getenv("API_KEY"); apiKey != "" {
		config.Auth.APIKey.Keys = []string{apiKey}
	}

	// Create server
	srv, err := server.New(config, deps)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// Start server in a goroutine
	go func() {
		if err := srv.Start(); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("\n🛑 Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Stop(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	fmt.Println("✅ Server exited properly")
}

// registerDefaultTemplates registers builtin agent templates
func registerDefaultTemplates(registry *agent.TemplateRegistry) {
	// Get provider and model from environment, with fallbacks
	provider := os.Getenv("PROVIDER")
	if provider == "" {
		provider = "anthropic"
	}
	
	model := os.Getenv("MODEL")
	if model == "" {
		if provider == "deepseek" {
			model = "deepseek-chat"
		} else {
			model = "claude-sonnet-4"
		}
	}
	
	// Register "chat" template - simple chat agent with prompt compression
	registry.Register(&types.AgentTemplateDefinition{
		ID:           "chat",
		Model:        model,
		SystemPrompt: `You are a helpful AI assistant with access to various tools. When users ask you to:

1. Read files or directories: Use the Read tool
2. Write or edit files: Use the Write or Edit tools
3. Search for files: Use the Glob tool
4. Search within files: Use the Grep tool
5. Execute commands: Use the Bash tool
6. Make web requests: Use the HttpRequest tool
7. Search the web: Use the WebSearch tool

Always use the appropriate tool when possible instead of just explaining what you would do. Tools help you actually perform tasks for the user.

When you receive a tool request, think about what tool is needed and use it. After using a tool, explain what you found or did.

If you're unsure whether to use a tool, err on the side of using it - it's better to try and help than to just describe.

## Additional Context
This is additional content to make the system prompt longer for testing compression.
The compression system will automatically activate when the prompt exceeds the threshold.

### Security Guidelines
IMPORTANT: Always follow security best practices:
- Never expose sensitive credentials
- Validate all user inputs
- Use secure connections when possible

### Performance Tips
- Use streaming for large outputs
- Cache frequently accessed data
- Minimize unnecessary API calls

### Code Quality Standards
- Follow consistent coding conventions
- Write meaningful comments
- Include error handling

### Testing Requirements
- Write unit tests for new features
- Ensure backward compatibility
- Test edge cases thoroughly`,
		Tools: "*", // Enable all tools
		Runtime: &types.AgentTemplateRuntime{
			PromptCompression: &types.PromptCompressionConfig{
				Enabled:          true,
				MaxLength:        1500, // 降低阈值便于测试
				TargetLength:     800,
				Mode:             "hybrid",
				Level:            2,
				PreserveSections: []string{"Tools Manual", "Security Guidelines"},
				CacheEnabled:     true,
				Language:         "zh",
			},
			// 对话历史压缩配置 - 类似 Claude Code 的 tokenBudget 机制
			ConversationCompression: &types.ConversationCompressionConfig{
				Enabled:           true,
				TokenBudget:       5000,  // 降低预算便于测试 (生产环境建议 200000)
				Threshold:         0.80,  // 80% 使用率触发压缩
				MinMessagesToKeep: 4,     // 保留最近 4 条消息
				SummaryLanguage:   "zh",
				UseLLMSummarizer:  false, // 使用规则摘要，速度更快
			},
		},
	})
	
	// Register "default-agent" template (alias for chat)
	registry.Register(&types.AgentTemplateDefinition{
		ID:           "default-agent",
		Model:        model,
		SystemPrompt: `You are a helpful AI assistant with access to various tools. When users ask you to:

1. Read files or directories: Use the Read tool
2. Write or edit files: Use the Write or Edit tools
3. Search for files: Use the Glob tool
4. Search within files: Use the Grep tool
5. Execute commands: Use the Bash tool
6. Make web requests: Use the HttpRequest tool
7. Search the web: Use the WebSearch tool

Always use the appropriate tool when possible instead of just explaining what you would do. Tools help you actually perform tasks for the user.

When you receive a tool request, think about what tool is needed and use it. After using a tool, explain what you found or did.

If you're unsure whether to use a tool, err on the side of using it - it's better to try and help than to just describe.`,
		Tools:        "*",
	})

	// Register "code-assistant" template
	registry.Register(&types.AgentTemplateDefinition{
		ID:           "code-assistant",
		Model:        model,
		SystemPrompt: `You are an expert programming assistant with access to various tools. When users ask for code-related help:

1. Read source files: Use the Read tool
2. Write or edit code files: Use the Write or Edit tools
3. Search for code patterns: Use the Grep tool
4. Find files by pattern: Use the Glob tool
5. Build/test code: Use the Bash tool
6. Check documentation: Use the HttpRequest or WebSearch tools

Always prefer to actually read the code, make the changes, or run the commands rather than just describing what to do. Use your tools to examine real code and make real modifications.

Explain what you're doing and why, but focus on actually solving the programming problem using available tools.`,
		Tools:        "*",
	})
	
	fmt.Printf("✅ Registered default templates (Provider: %s, Model: %s)\n", provider, model)
}
