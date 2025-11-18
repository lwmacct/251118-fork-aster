package main

import (
	"flag"
	"fmt"
	"log"
	"os"

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

// runServe 启动 HTTP Server（开发模式 - 使用简化配置）
func runServe(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	host := fs.String("host", "0.0.0.0", "HTTP listen host")
	port := fs.Int("port", 8080, "HTTP listen port")
	storeDir := fs.String("store", ".aster", "Directory for JSON store data")
	mode := fs.String("mode", "debug", "Server mode: debug, release")

	if err := fs.Parse(args); err != nil {
		return err
	}

	// 创建 Store
	jsonStore, err := store.NewJSONStore(*storeDir)
	if err != nil {
		return fmt.Errorf("create store: %w", err)
	}

	// 创建 Agent 依赖
	toolRegistry := tools.NewRegistry()
	builtin.RegisterAll(toolRegistry)

	sandboxFactory := sandbox.NewFactory()
	providerFactory := provider.NewMultiProviderFactory()
	templateRegistry := agent.NewTemplateRegistry()
	registerBuiltinTemplates(templateRegistry)

	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
	if anthropicKey == "" {
		log.Println("[WARN] ANTHROPIC_API_KEY not set")
	}

	defaultModel := &types.ModelConfig{
		Provider: "anthropic",
		Model:    "claude-sonnet-4-5",
		APIKey:   anthropicKey,
	}
	routes := []router.StaticRouteEntry{
		{Task: "chat", Priority: router.PriorityQuality, Model: defaultModel},
	}
	rt := router.NewStaticRouter(defaultModel, routes)

	agentDeps := &agent.Dependencies{
		Store:            jsonStore,
		ToolRegistry:     toolRegistry,
		SandboxFactory:   sandboxFactory,
		ProviderFactory:  providerFactory,
		TemplateRegistry: templateRegistry,
		Router:           rt,
	}

	// 创建 Server 依赖
	serverDeps := &server.Dependencies{
		Store:     jsonStore,
		AgentDeps: agentDeps,
	}

	// 创建简化的开发配置
	config := &server.Config{
		Host: *host,
		Port: *port,
		Mode: *mode,
		Auth: server.AuthConfig{
			APIKey: server.APIKeyConfig{
				Enabled: false, // 开发模式默认不启用认证
			},
		},
		CORS: server.CORSConfig{
			Enabled:      true,
			AllowOrigins: []string{"*"},
			AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowHeaders: []string{"Content-Type", "Authorization", "X-API-Key"},
		},
		RateLimit: server.RateLimitConfig{
			Enabled: false, // 开发模式不启用速率限制
		},
		Logging: server.LoggingConfig{
			Level:  "info",
			Format: "text",
		},
	}

	// 创建并启动 Server
	srv, err := server.New(config, serverDeps)
	if err != nil {
		return fmt.Errorf("create server: %w", err)
	}

	// 打印启动信息
	printDevServerInfo(*host, *port)

	// 启动服务器（阻塞）
	return srv.Start()
}

// registerBuiltinTemplates 注册内置模板
func registerBuiltinTemplates(registry *agent.TemplateRegistry) {
	registry.Register(&types.AgentTemplateDefinition{
		ID:           "assistant",
		SystemPrompt: "You are a helpful assistant.",
		Tools:        []interface{}{"filesystem", "bash"},
	})

	registry.Register(&types.AgentTemplateDefinition{
		ID:           "coder",
		SystemPrompt: "You are an expert programmer.",
		Tools:        []interface{}{"filesystem", "bash", "grep"},
	})
}

// printDevServerInfo 打印开发服务器启动信息
func printDevServerInfo(host string, port int) {
	fmt.Printf("\n🚀 aster 星尘云枢 Development Server\n")
	fmt.Printf("   Address: http://%s:%d\n", host, port)
	fmt.Printf("   Mode: Development (no auth, CORS enabled)\n\n")

	fmt.Println("📍 API Endpoints:")
	fmt.Println("   GET    /health                    Health check")
	fmt.Println("   GET    /v1/agents                 List agents")
	fmt.Println("   POST   /v1/agents                 Create agent")
	fmt.Println("   GET    /v1/memory/working         List working memory")
	fmt.Println("   GET    /v1/sessions               List sessions")
	fmt.Println("   GET    /v1/workflows              List workflows")
	fmt.Println("   GET    /v1/tools                  List tools")
	fmt.Println("   POST   /v1/eval/text              Run text eval")
	fmt.Println("   GET    /v1/mcp/servers            List MCP servers")
	fmt.Println()
	fmt.Println("📚 Documentation:")
	fmt.Println("   https://github.com/astercloud/aster")
	fmt.Println()
	fmt.Println("⚠️  Development mode: Authentication disabled")
	fmt.Println("   For production, use: aster-server")
	fmt.Println()
}
