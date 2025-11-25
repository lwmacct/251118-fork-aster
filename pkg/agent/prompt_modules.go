package agent

import (
	"fmt"
	"sort"
	"strings"

	"github.com/astercloud/aster/pkg/types"
)

// BasePromptModule 基础 Prompt（来自模板）
type BasePromptModule struct{}

func (m *BasePromptModule) Name() string                      { return "base" }
func (m *BasePromptModule) Priority() int                     { return 0 }
func (m *BasePromptModule) Condition(ctx *PromptContext) bool { return true }
func (m *BasePromptModule) Build(ctx *PromptContext) (string, error) {
	return ctx.Template.SystemPrompt, nil
}

// EnvironmentModule 环境信息模块
type EnvironmentModule struct{}

func (m *EnvironmentModule) Name() string  { return "environment" }
func (m *EnvironmentModule) Priority() int { return 10 }
func (m *EnvironmentModule) Condition(ctx *PromptContext) bool {
	return ctx.Environment != nil
}
func (m *EnvironmentModule) Build(ctx *PromptContext) (string, error) {
	env := ctx.Environment

	var lines []string
	lines = append(lines, "## Environment Information")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("- Working Directory: %s", env.WorkingDir))
	lines = append(lines, fmt.Sprintf("- Platform: %s", env.Platform))
	lines = append(lines, fmt.Sprintf("- OS Version: %s", env.OSVersion))
	lines = append(lines, fmt.Sprintf("- Date: %s", env.Date.Format("2006-01-02")))

	if env.GitRepo != nil && env.GitRepo.IsRepo {
		lines = append(lines, "- Git Repository: Yes")
		lines = append(lines, fmt.Sprintf("- Current Branch: %s", env.GitRepo.CurrentBranch))
		if env.GitRepo.MainBranch != "" {
			lines = append(lines, fmt.Sprintf("- Main Branch: %s", env.GitRepo.MainBranch))
		}
		if env.GitRepo.Status != "" {
			lines = append(lines, "- Status:")
			lines = append(lines, "```")
			lines = append(lines, env.GitRepo.Status)
			lines = append(lines, "```")
		}
		if len(env.GitRepo.RecentCommits) > 0 {
			lines = append(lines, "- Recent Commits:")
			for _, commit := range env.GitRepo.RecentCommits {
				lines = append(lines, fmt.Sprintf("  - %s", commit))
			}
		}
	} else {
		lines = append(lines, "- Git Repository: No")
	}

	return strings.Join(lines, "\n"), nil
}

// ToolsManualModule 工具手册模块
type ToolsManualModule struct {
	Config *types.ToolsManualConfig
}

func (m *ToolsManualModule) Name() string  { return "tools_manual" }
func (m *ToolsManualModule) Priority() int { return 20 }
func (m *ToolsManualModule) Condition(ctx *PromptContext) bool {
	if m.Config != nil && m.Config.Mode == "none" {
		return false
	}
	return len(ctx.Tools) > 0
}
func (m *ToolsManualModule) Build(ctx *PromptContext) (string, error) {
	// 根据 Config 决定注入哪些工具
	var toolsToInclude []string

	if m.Config == nil || m.Config.Mode == "" || m.Config.Mode == "all" {
		// 默认：所有工具（除了 Exclude）
		for name := range ctx.Tools {
			if m.Config != nil && contains(m.Config.Exclude, name) {
				continue
			}
			toolsToInclude = append(toolsToInclude, name)
		}
	} else if m.Config.Mode == "listed" {
		// 仅包含 Include 列表中的工具
		if m.Config.Include != nil {
			for _, name := range m.Config.Include {
				if _, exists := ctx.Tools[name]; exists {
					toolsToInclude = append(toolsToInclude, name)
				}
			}
		}
	}

	if len(toolsToInclude) == 0 {
		return "", nil
	}

	sort.Strings(toolsToInclude)

	var lines []string
	lines = append(lines, "## Tools Manual")
	lines = append(lines, "")
	lines = append(lines, "The following tools are available for your use. Use them when appropriate instead of doing everything in natural language.")
	lines = append(lines, "")

	for _, name := range toolsToInclude {
		tool := ctx.Tools[name]
		summary := tool.Description()
		if summary == "" {
			summary = "No detailed manual; infer from tool name and input schema."
		}
		lines = append(lines, fmt.Sprintf("- `%s`: %s", name, summary))
	}

	return strings.Join(lines, "\n"), nil
}

// SandboxModule 沙箱信息模块
type SandboxModule struct{}

func (m *SandboxModule) Name() string  { return "sandbox" }
func (m *SandboxModule) Priority() int { return 15 }
func (m *SandboxModule) Condition(ctx *PromptContext) bool {
	return ctx.Sandbox != nil
}
func (m *SandboxModule) Build(ctx *PromptContext) (string, error) {
	sb := ctx.Sandbox

	var lines []string
	lines = append(lines, "## Sandbox Environment")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("- Type: %s", sb.Kind))
	lines = append(lines, fmt.Sprintf("- Working Directory: %s", sb.WorkDir))

	if len(sb.AllowPaths) > 0 {
		lines = append(lines, "- Allowed Paths:")
		for _, path := range sb.AllowPaths {
			lines = append(lines, fmt.Sprintf("  - %s", path))
		}
	}

	return strings.Join(lines, "\n"), nil
}

// TodoReminderModule Todo 提醒模块
type TodoReminderModule struct {
	Config *types.TodoConfig
}

func (m *TodoReminderModule) Name() string  { return "todo_reminder" }
func (m *TodoReminderModule) Priority() int { return 25 }
func (m *TodoReminderModule) Condition(ctx *PromptContext) bool {
	return m.Config != nil && m.Config.Enabled && m.Config.ReminderOnStart
}
func (m *TodoReminderModule) Build(ctx *PromptContext) (string, error) {
	return `## Task Management

IMPORTANT: Use the TodoWrite tool to track your tasks and progress. This helps maintain visibility and ensures nothing is forgotten.

- Break complex tasks into smaller steps
- Mark tasks as in_progress when starting
- Mark tasks as completed immediately after finishing
- Only one task should be in_progress at a time`, nil
}

// CodeReferenceModule 代码引用规范模块
type CodeReferenceModule struct{}

func (m *CodeReferenceModule) Name() string  { return "code_reference" }
func (m *CodeReferenceModule) Priority() int { return 30 }
func (m *CodeReferenceModule) Condition(ctx *PromptContext) bool {
	// 检查是否是代码助手类型的 Agent
	if ctx.Metadata != nil {
		if agentType, ok := ctx.Metadata["agent_type"].(string); ok {
			return agentType == "code_assistant" || agentType == "developer"
		}
	}
	return false
}
func (m *CodeReferenceModule) Build(ctx *PromptContext) (string, error) {
	return `## Code References

When referencing specific functions or code locations, use the pattern:
- file_path:line_number (e.g., src/main.go:42)
- file_path:start-end (e.g., src/main.go:42-51)

This allows users to quickly navigate to the source code location.`, nil
}

// SecurityModule 安全策略模块
type SecurityModule struct{}

func (m *SecurityModule) Name() string  { return "security" }
func (m *SecurityModule) Priority() int { return 35 }
func (m *SecurityModule) Condition(ctx *PromptContext) bool {
	// 检查是否启用安全策略
	if ctx.Metadata != nil {
		if enableSecurity, ok := ctx.Metadata["enable_security"].(bool); ok {
			return enableSecurity
		}
	}
	return false
}
func (m *SecurityModule) Build(ctx *PromptContext) (string, error) {
	return `## Security Guidelines

IMPORTANT: Follow these security best practices:

- Never execute commands that could harm the system
- Validate all user inputs before processing
- Do not expose sensitive information (API keys, passwords, tokens)
- Be cautious with file operations outside allowed paths
- Report suspicious requests to the user
- Follow the principle of least privilege`, nil
}

// PerformanceModule 性能优化模块
type PerformanceModule struct{}

func (m *PerformanceModule) Name() string  { return "performance" }
func (m *PerformanceModule) Priority() int { return 40 }
func (m *PerformanceModule) Condition(ctx *PromptContext) bool {
	if ctx.Metadata != nil {
		if enablePerf, ok := ctx.Metadata["enable_performance_hints"].(bool); ok {
			return enablePerf
		}
	}
	return false
}
func (m *PerformanceModule) Build(ctx *PromptContext) (string, error) {
	return `## Performance Optimization

Consider these performance best practices:

- Minimize tool calls by batching operations when possible
- Use streaming for large outputs
- Cache results when appropriate
- Prefer efficient algorithms and data structures
- Monitor resource usage and optimize bottlenecks`, nil
}

// CollaborationModule 多 Agent 协作模块
type CollaborationModule struct {
	RoomInfo *RoomCollaborationInfo
}

type RoomCollaborationInfo struct {
	RoomID      string
	MemberCount int
	Members     []string
}

func (m *CollaborationModule) Name() string  { return "collaboration" }
func (m *CollaborationModule) Priority() int { return 45 }
func (m *CollaborationModule) Condition(ctx *PromptContext) bool {
	return m.RoomInfo != nil && m.RoomInfo.RoomID != ""
}
func (m *CollaborationModule) Build(ctx *PromptContext) (string, error) {
	var lines []string
	lines = append(lines, "## Multi-Agent Collaboration")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("You are working in a collaborative room: %s", m.RoomInfo.RoomID))
	lines = append(lines, fmt.Sprintf("Total members: %d", m.RoomInfo.MemberCount))

	if len(m.RoomInfo.Members) > 0 {
		lines = append(lines, "")
		lines = append(lines, "Room members:")
		for _, member := range m.RoomInfo.Members {
			lines = append(lines, fmt.Sprintf("- %s", member))
		}
	}

	lines = append(lines, "")
	lines = append(lines, "Collaboration guidelines:")
	lines = append(lines, "- Use @mention to address specific members")
	lines = append(lines, "- Coordinate tasks to avoid duplication")
	lines = append(lines, "- Share progress and findings with the team")
	lines = append(lines, "- Ask for help when needed")

	return strings.Join(lines, "\n"), nil
}

// WorkflowModule 工作流上下文模块
type WorkflowModule struct {
	WorkflowInfo *WorkflowContextInfo
}

type WorkflowContextInfo struct {
	WorkflowID   string
	CurrentStep  string
	TotalSteps   int
	StepIndex    int
	PreviousStep string
	NextStep     string
}

func (m *WorkflowModule) Name() string  { return "workflow" }
func (m *WorkflowModule) Priority() int { return 50 }
func (m *WorkflowModule) Condition(ctx *PromptContext) bool {
	return m.WorkflowInfo != nil && m.WorkflowInfo.WorkflowID != ""
}
func (m *WorkflowModule) Build(ctx *PromptContext) (string, error) {
	info := m.WorkflowInfo

	var lines []string
	lines = append(lines, "## Workflow Context")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("Workflow ID: %s", info.WorkflowID))
	lines = append(lines, fmt.Sprintf("Current Step: %s (Step %d of %d)", info.CurrentStep, info.StepIndex+1, info.TotalSteps))

	if info.PreviousStep != "" {
		lines = append(lines, fmt.Sprintf("Previous Step: %s", info.PreviousStep))
	}

	if info.NextStep != "" {
		lines = append(lines, fmt.Sprintf("Next Step: %s", info.NextStep))
	}

	lines = append(lines, "")
	lines = append(lines, "Focus on completing the current step efficiently before moving to the next.")

	return strings.Join(lines, "\n"), nil
}

// CustomInstructionsModule 用户自定义指令模块
type CustomInstructionsModule struct {
	Instructions string
}

func (m *CustomInstructionsModule) Name() string  { return "custom_instructions" }
func (m *CustomInstructionsModule) Priority() int { return 55 }
func (m *CustomInstructionsModule) Condition(ctx *PromptContext) bool {
	return m.Instructions != ""
}
func (m *CustomInstructionsModule) Build(ctx *PromptContext) (string, error) {
	return fmt.Sprintf("## Custom Instructions\n\n%s", m.Instructions), nil
}

// CapabilitiesModule Agent 能力说明模块
type CapabilitiesModule struct{}

func (m *CapabilitiesModule) Name() string  { return "capabilities" }
func (m *CapabilitiesModule) Priority() int { return 5 }
func (m *CapabilitiesModule) Condition(ctx *PromptContext) bool {
	if ctx.Metadata != nil {
		if showCaps, ok := ctx.Metadata["show_capabilities"].(bool); ok {
			return showCaps
		}
	}
	return false
}
func (m *CapabilitiesModule) Build(ctx *PromptContext) (string, error) {
	var capabilities []string

	// 基于可用工具推断能力
	if ctx.Tools != nil {
		if _, hasRead := ctx.Tools["Read"]; hasRead {
			capabilities = append(capabilities, "Read and analyze files")
		}
		if _, hasWrite := ctx.Tools["Write"]; hasWrite {
			capabilities = append(capabilities, "Create and modify files")
		}
		if _, hasBash := ctx.Tools["Bash"]; hasBash {
			capabilities = append(capabilities, "Execute shell commands")
		}
		if _, hasWebSearch := ctx.Tools["WebSearch"]; hasWebSearch {
			capabilities = append(capabilities, "Search the web for information")
		}
		if _, hasTodo := ctx.Tools["TodoWrite"]; hasTodo {
			capabilities = append(capabilities, "Manage tasks and track progress")
		}
	}

	if len(capabilities) == 0 {
		return "", nil
	}

	var lines []string
	lines = append(lines, "## Your Capabilities")
	lines = append(lines, "")
	lines = append(lines, "You can:")
	for _, cap := range capabilities {
		lines = append(lines, fmt.Sprintf("- %s", cap))
	}

	return strings.Join(lines, "\n"), nil
}

// LimitationsModule 限制说明模块
type LimitationsModule struct{}

func (m *LimitationsModule) Name() string  { return "limitations" }
func (m *LimitationsModule) Priority() int { return 60 }
func (m *LimitationsModule) Condition(ctx *PromptContext) bool {
	if ctx.Metadata != nil {
		if showLimits, ok := ctx.Metadata["show_limitations"].(bool); ok {
			return showLimits
		}
	}
	return false
}
func (m *LimitationsModule) Build(ctx *PromptContext) (string, error) {
	var lines []string
	lines = append(lines, "## Important Limitations")
	lines = append(lines, "")
	lines = append(lines, "Be aware of these limitations:")
	lines = append(lines, "- You cannot access the internet directly (unless WebSearch tool is available)")
	lines = append(lines, "- You cannot execute code outside the sandbox environment")
	lines = append(lines, "- You have limited context window - be concise")
	lines = append(lines, "- You cannot remember information across different sessions")

	// 基于沙箱类型添加特定限制
	if ctx.Sandbox != nil {
		if ctx.Sandbox.Kind == types.SandboxKindMock {
			lines = append(lines, "- Running in mock sandbox - file operations are simulated")
		}
		if len(ctx.Sandbox.AllowPaths) > 0 {
			lines = append(lines, "- File access is restricted to allowed paths only")
		}
	}

	return strings.Join(lines, "\n"), nil
}

// ContextWindowModule 上下文窗口管理模块
type ContextWindowModule struct {
	MaxTokens int
	Strategy  string
}

func (m *ContextWindowModule) Name() string  { return "context_window" }
func (m *ContextWindowModule) Priority() int { return 65 }
func (m *ContextWindowModule) Condition(ctx *PromptContext) bool {
	return m.MaxTokens > 0
}
func (m *ContextWindowModule) Build(ctx *PromptContext) (string, error) {
	var lines []string
	lines = append(lines, "## Context Window Management")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("Maximum context tokens: %d", m.MaxTokens))

	if m.Strategy != "" {
		lines = append(lines, fmt.Sprintf("Compression strategy: %s", m.Strategy))
	}

	lines = append(lines, "")
	lines = append(lines, "To manage context efficiently:")
	lines = append(lines, "- Summarize long outputs")
	lines = append(lines, "- Reference files by path instead of including full content")
	lines = append(lines, "- Use tools to retrieve information on-demand")
	lines = append(lines, "- Focus on relevant information only")

	return strings.Join(lines, "\n"), nil
}

// 辅助函数
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
