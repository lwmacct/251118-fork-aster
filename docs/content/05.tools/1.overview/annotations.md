---
title: 工具注解系统
description: 为工具添加安全注解，支持智能审批和风险评估
navigation:
  icon: i-lucide-shield-check
---

# 工具注解系统

工具注解系统为每个工具提供安全元数据，用于自动化权限决策和风险评估。

## 📋 概述

工具注解 (`ToolAnnotations`) 描述工具的安全特征：

```go
type ToolAnnotations struct {
    ReadOnly             bool   // 是否只读（不修改任何状态）
    Destructive          bool   // 是否具有破坏性（可能导致数据丢失）
    Idempotent           bool   // 是否幂等（多次执行结果相同）
    OpenWorld            bool   // 是否涉及外部系统（网络、第三方API）
    RiskLevel            int    // 风险级别 (0-4)
    Category             string // 工具分类
    RequiresConfirmation bool   // 是否需要用户确认
}
```

## 🎯 风险级别

| 级别 | 名称     | 说明                       | 示例工具             |
| ---- | -------- | -------------------------- | -------------------- |
| 0    | Safe     | 安全操作，无副作用         | Read, Glob           |
| 1    | Low      | 低风险操作                 | Write（覆盖写入）    |
| 2    | Medium   | 中等风险                   | WebFetch, 数据库写入 |
| 3    | High     | 高风险，可能破坏性         | Bash, 文件删除       |
| 4    | Critical | 极高风险，需要特别审批     | 系统修改、批量删除   |

## 🛠️ 预定义注解模板

```go
import "github.com/astercloud/aster/pkg/tools"

// 安全只读操作（如 Read, Glob, Grep）
tools.AnnotationsSafeReadOnly

// 安全写入操作（如 Write）
tools.AnnotationsSafeWrite

// 破坏性写入（如删除文件）
tools.AnnotationsDestructiveWrite

// 命令执行（如 Bash）
tools.AnnotationsExecution

// 网络只读（如 WebFetch, WebSearch）
tools.AnnotationsNetworkRead

// 网络写入（如 HTTP POST）
tools.AnnotationsNetworkWrite

// 数据库只读
tools.AnnotationsDatabaseRead

// 数据库写入
tools.AnnotationsDatabaseWrite

// MCP 工具（动态加载）
tools.AnnotationsMCPTool

// 用户交互工具
tools.AnnotationsUserInteraction
```

## 🔧 为自定义工具添加注解

实现 `AnnotatedTool` 接口：

```go
import "github.com/astercloud/aster/pkg/tools"

type MyCustomTool struct {
    // ...
}

// 实现 Tool 接口
func (t *MyCustomTool) Name() string { return "MyTool" }
func (t *MyCustomTool) Description() string { return "自定义工具" }
func (t *MyCustomTool) InputSchema() map[string]any { return nil }
func (t *MyCustomTool) Execute(ctx context.Context, input map[string]any, tc *tools.ToolContext) (any, error) {
    // ...
}
func (t *MyCustomTool) Prompt() string { return "" }

// 实现 AnnotatedTool 接口
func (t *MyCustomTool) Annotations() *tools.ToolAnnotations {
    return &tools.ToolAnnotations{
        ReadOnly:    false,
        Destructive: false,
        Idempotent:  true,
        OpenWorld:   false,
        RiskLevel:   tools.RiskLevelLow,
        Category:    "custom",
    }
}
```

## 🔒 SmartApprove 权限模式

基于工具注解自动判断是否需要审批：

```go
import "github.com/astercloud/aster/pkg/types"

config := &types.AgentConfig{
    PermissionMode: types.PermissionModeSmartApprove,
}
```

**SmartApprove 规则**：
- ✅ 只读 + 非外部系统 → 自动批准
- ⚠️ 只读 + 外部系统 → 需要审批
- ⚠️ 非只读操作 → 需要审批
- 🚫 破坏性操作 → 强制审批

## 📊 辅助函数

```go
// 获取工具注解（兼容未实现接口的工具）
ann := tools.GetAnnotations(myTool)

// 判断是否可自动批准
if tools.IsToolSafeForAutoApproval(myTool) {
    // 自动执行
}

// 获取风险级别
riskLevel := tools.GetToolRiskLevel(myTool)
fmt.Printf("风险级别: %s\n", ann.RiskLevelName())
```

## 🏷️ 内置工具注解

| 工具      | ReadOnly | Destructive | OpenWorld | RiskLevel |
| --------- | -------- | ----------- | --------- | --------- |
| Read      | ✅        | ❌           | ❌         | Safe      |
| Glob      | ✅        | ❌           | ❌         | Safe      |
| Grep      | ✅        | ❌           | ❌         | Safe      |
| Write     | ❌        | ❌           | ❌         | Low       |
| Bash      | ❌        | ✅           | ✅         | High      |
| WebFetch  | ✅        | ❌           | ✅         | Low       |
| WebSearch | ✅        | ❌           | ✅         | Low       |

## 💡 最佳实践

1. **保守原则**：不确定时使用更高的风险级别
2. **网络操作标记 OpenWorld**：任何涉及网络的工具都应设置 `OpenWorld: true`
3. **破坏性操作标记 Destructive**：删除、覆盖、修改系统设置等操作
4. **幂等操作标记 Idempotent**：如文件覆盖写入、PUT 请求等
5. **分类清晰**：使用明确的 Category 便于日志和监控

## 🔗 相关文档

- [权限控制](/core-concepts/permissions)
- [Human-in-the-Loop](/middleware/builtin/human-in-the-loop)
- [自定义工具](/tools/custom)
