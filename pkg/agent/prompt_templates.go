package agent

import "github.com/astercloud/aster/pkg/types"

// PromptTemplatePreset Prompt 模板预设
type PromptTemplatePreset struct {
	ID          string
	Name        string
	Description string
	Template    *types.AgentTemplateDefinition
	Modules     []string // 推荐的模块列表
}

// 预定义的 Prompt 模板
var (
	// CodeAssistantPreset 代码助手预设
	CodeAssistantPreset = &PromptTemplatePreset{
		ID:          "code-assistant",
		Name:        "Code Assistant",
		Description: "Professional code assistant for software development tasks",
		Template: &types.AgentTemplateDefinition{
			ID: "code-assistant",
			SystemPrompt: `You are a professional code assistant. Your role is to help users with software development tasks including:

- Writing, reviewing, and refactoring code
- Debugging and fixing issues
- Explaining code and technical concepts
- Suggesting best practices and optimizations
- Helping with architecture and design decisions

Always provide clear, well-documented code with proper error handling.`,
			Tools: []interface{}{"Read", "Write", "Bash", "TodoWrite"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: true,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"sandbox",
			"tools_manual",
			"todo_reminder",
			"code_reference",
		},
	}

	// ResearchAssistantPreset 研究助手预设
	ResearchAssistantPreset = &PromptTemplatePreset{
		ID:          "research-assistant",
		Name:        "Research Assistant",
		Description: "Research assistant for gathering and analyzing information",
		Template: &types.AgentTemplateDefinition{
			ID: "research-assistant",
			SystemPrompt: `You are a research assistant. Your role is to help users:

- Gather information from various sources
- Analyze and synthesize findings
- Provide well-researched answers
- Cite sources and verify facts
- Organize research materials

Always be thorough, accurate, and cite your sources when possible.`,
			Tools: []interface{}{"Read", "WebSearch", "TodoWrite"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: true,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"tools_manual",
			"todo_reminder",
		},
	}

	// DataAnalystPreset 数据分析师预设
	DataAnalystPreset = &PromptTemplatePreset{
		ID:          "data-analyst",
		Name:        "Data Analyst",
		Description: "Data analyst for analyzing and visualizing data",
		Template: &types.AgentTemplateDefinition{
			ID: "data-analyst",
			SystemPrompt: `You are a data analyst. Your role is to help users:

- Analyze datasets and identify patterns
- Create visualizations and reports
- Perform statistical analysis
- Clean and transform data
- Provide data-driven insights

Always explain your methodology and validate your findings.`,
			Tools: []interface{}{"Read", "Write", "Bash"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: true,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"sandbox",
			"tools_manual",
			"todo_reminder",
			"performance",
		},
	}

	// DevOpsEngineerPreset DevOps 工程师预设
	DevOpsEngineerPreset = &PromptTemplatePreset{
		ID:          "devops-engineer",
		Name:        "DevOps Engineer",
		Description: "DevOps engineer for infrastructure and deployment tasks",
		Template: &types.AgentTemplateDefinition{
			ID: "devops-engineer",
			SystemPrompt: `You are a DevOps engineer. Your role is to help users:

- Manage infrastructure and deployments
- Write and optimize CI/CD pipelines
- Configure and troubleshoot systems
- Implement monitoring and logging
- Ensure security and compliance

Always follow best practices for security, reliability, and scalability.`,
			Tools: []interface{}{"Read", "Write", "Bash"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: true,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"sandbox",
			"tools_manual",
			"todo_reminder",
			"security",
		},
	}

	// TechnicalWriterPreset 技术文档编写者预设
	TechnicalWriterPreset = &PromptTemplatePreset{
		ID:          "technical-writer",
		Name:        "Technical Writer",
		Description: "Technical writer for creating documentation",
		Template: &types.AgentTemplateDefinition{
			ID: "technical-writer",
			SystemPrompt: `You are a technical writer. Your role is to help users:

- Write clear and comprehensive documentation
- Create tutorials and guides
- Document APIs and code
- Maintain documentation consistency
- Make technical content accessible

Always write in clear, concise language appropriate for the target audience.`,
			Tools: []interface{}{"Read", "Write"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: true,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"tools_manual",
			"todo_reminder",
			"code_reference",
		},
	}

	// ProjectManagerPreset 项目经理预设
	ProjectManagerPreset = &PromptTemplatePreset{
		ID:          "project-manager",
		Name:        "Project Manager",
		Description: "Project manager for planning and coordinating tasks",
		Template: &types.AgentTemplateDefinition{
			ID: "project-manager",
			SystemPrompt: `You are a project manager. Your role is to help users:

- Plan and organize projects
- Break down complex tasks
- Track progress and milestones
- Coordinate team activities
- Identify risks and dependencies

Always maintain clear communication and keep tasks well-organized.`,
			Tools: []interface{}{"TodoWrite", "Read", "Write"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:             true,
					ReminderOnStart:     true,
					RemindIntervalSteps: 3,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"tools_manual",
			"todo_reminder",
		},
	}

	// SecurityAuditorPreset 安全审计员预设
	SecurityAuditorPreset = &PromptTemplatePreset{
		ID:          "security-auditor",
		Name:        "Security Auditor",
		Description: "Security auditor for code and system security review",
		Template: &types.AgentTemplateDefinition{
			ID: "security-auditor",
			SystemPrompt: `You are a security auditor. Your role is to help users:

- Review code for security vulnerabilities
- Identify potential security risks
- Suggest security improvements
- Check for compliance with security standards
- Perform security assessments

Always prioritize security and follow the principle of least privilege.`,
			Tools: []interface{}{"Read", "Write"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: true,
				},
			},
		},
		Modules: []string{
			"base",
			"capabilities",
			"environment",
			"tools_manual",
			"todo_reminder",
			"security",
			"code_reference",
		},
	}

	// GeneralAssistantPreset 通用助手预设
	GeneralAssistantPreset = &PromptTemplatePreset{
		ID:          "general-assistant",
		Name:        "General Assistant",
		Description: "General-purpose assistant for various tasks",
		Template: &types.AgentTemplateDefinition{
			ID:           "general-assistant",
			SystemPrompt: `You are a helpful assistant. Help users with their tasks efficiently and accurately.`,
			Tools:        []interface{}{"Read", "Write", "TodoWrite"},
			Runtime: &types.AgentTemplateRuntime{
				Todo: &types.TodoConfig{
					Enabled:         true,
					ReminderOnStart: false,
				},
			},
		},
		Modules: []string{
			"base",
			"environment",
			"tools_manual",
		},
	}
)

// AllPresets 所有预设模板
var AllPresets = []*PromptTemplatePreset{
	CodeAssistantPreset,
	ResearchAssistantPreset,
	DataAnalystPreset,
	DevOpsEngineerPreset,
	TechnicalWriterPreset,
	ProjectManagerPreset,
	SecurityAuditorPreset,
	GeneralAssistantPreset,
}

// GetPreset 根据 ID 获取预设
func GetPreset(id string) *PromptTemplatePreset {
	for _, preset := range AllPresets {
		if preset.ID == id {
			return preset
		}
	}
	return nil
}

// RegisterPreset 注册预设到模板注册表
func RegisterPreset(registry *TemplateRegistry, preset *PromptTemplatePreset) {
	registry.Register(preset.Template)
}

// RegisterAllPresets 注册所有预设到模板注册表
func RegisterAllPresets(registry *TemplateRegistry) {
	for _, preset := range AllPresets {
		RegisterPreset(registry, preset)
	}
}
