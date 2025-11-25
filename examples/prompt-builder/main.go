package main

import (
	"context"
	"fmt"
	"log"

	"github.com/astercloud/aster/pkg/agent"
	"github.com/astercloud/aster/pkg/provider"
	"github.com/astercloud/aster/pkg/sandbox"
	"github.com/astercloud/aster/pkg/store"
	"github.com/astercloud/aster/pkg/tools"
	"github.com/astercloud/aster/pkg/types"
)

func main() {
	ctx := context.Background()

	// 1. 创建依赖
	deps := createDependencies()

	// 2. 创建代码助手 Agent（会自动注入代码引用规范）
	fmt.Println("=== 创建代码助手 Agent ===")
	codeAgent, err := agent.Create(ctx, &types.AgentConfig{
		TemplateID: "code-assistant",
		Metadata: map[string]interface{}{
			"agent_type": "code_assistant",
		},
		Tools: []string{"Read", "Write"},
	}, deps)
	if err != nil {
		log.Fatalf("创建代码助手失败: %v", err)
	}

	// 打印 System Prompt
	fmt.Println("\n代码助手的 System Prompt:")
	fmt.Println("---")
	fmt.Println(getSystemPrompt(codeAgent))
	fmt.Println("---")

	// 3. 创建研究助手 Agent（不会注入代码引用规范）
	fmt.Println("\n=== 创建研究助手 Agent ===")
	researchAgent, err := agent.Create(ctx, &types.AgentConfig{
		TemplateID: "research-assistant",
		Metadata: map[string]interface{}{
			"agent_type": "researcher",
		},
		Tools: []string{"Read"},
	}, deps)
	if err != nil {
		log.Fatalf("创建研究助手失败: %v", err)
	}

	// 打印 System Prompt
	fmt.Println("\n研究助手的 System Prompt:")
	fmt.Println("---")
	fmt.Println(getSystemPrompt(researchAgent))
	fmt.Println("---")

	// 4. 创建带 Todo 提醒的 Agent
	fmt.Println("\n=== 创建带 Todo 提醒的 Agent ===")
	todoAgent, err := agent.Create(ctx, &types.AgentConfig{
		TemplateID: "todo-assistant",
		Tools:      []string{"Read", "Write"},
	}, deps)
	if err != nil {
		log.Fatalf("创建 Todo 助手失败: %v", err)
	}

	// 打印 System Prompt
	fmt.Println("\nTodo 助手的 System Prompt:")
	fmt.Println("---")
	fmt.Println(getSystemPrompt(todoAgent))
	fmt.Println("---")

	fmt.Println("\n✅ 所有 Agent 创建成功！")
}

func createDependencies() *agent.Dependencies {
	// 创建工具注册表
	toolRegistry := tools.NewRegistry()
	toolRegistry.Register("Read", func(config map[string]interface{}) (tools.Tool, error) {
		return &tools.ReadTool{}, nil
	})
	toolRegistry.Register("Write", func(config map[string]interface{}) (tools.Tool, error) {
		return &tools.WriteTool{}, nil
	})

	// 创建模板注册表
	templateRegistry := agent.NewTemplateRegistry()

	// 注册代码助手模板
	templateRegistry.Register(&types.AgentTemplateDefinition{
		ID:           "code-assistant",
		SystemPrompt: "You are a professional code assistant. Help users with software development tasks.",
		Tools:        []string{"Read", "Write"},
	})

	// 注册研究助手模板
	templateRegistry.Register(&types.AgentTemplateDefinition{
		ID:           "research-assistant",
		SystemPrompt: "You are a research assistant. Help users gather and analyze information.",
		Tools:        []string{"Read"},
	})

	// 注册带 Todo 提醒的模板
	templateRegistry.Register(&types.AgentTemplateDefinition{
		ID:           "todo-assistant",
		SystemPrompt: "You are a task management assistant.",
		Tools:        []string{"Read", "Write"},
		Runtime: &types.AgentTemplateRuntime{
			Todo: &types.TodoConfig{
				Enabled:         true,
				ReminderOnStart: true,
			},
		},
	})

	// 创建 Provider Factory
	providerFactory := provider.NewFactory()

	// 创建 Sandbox Factory
	sandboxFactory := sandbox.NewFactory()

	// 创建 Store
	memStore := store.NewMemoryStore()

	return &agent.Dependencies{
		ToolRegistry:     toolRegistry,
		TemplateRegistry: templateRegistry,
		ProviderFactory:  providerFactory,
		SandboxFactory:   sandboxFactory,
		Store:            memStore,
	}
}

// getSystemPrompt 获取 Agent 的 System Prompt
func getSystemPrompt(ag *agent.Agent) string {
	return ag.GetSystemPrompt()
}
