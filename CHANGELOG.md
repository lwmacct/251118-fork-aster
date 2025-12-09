# Changelog

## [v0.24.0] - 2025-12-09

### Added

- **EventBus 内存泄漏修复**: 添加 `NewEventBusWithConfig()` 构造函数，支持可配置的清理设置
- **EventBus 自动清理**: 实现后台清理 worker，按时间（默认1小时）和数量（默认10000）自动清理旧事件
- **EventBus 优雅关闭**: 添加 `Close()` 方法支持优雅关闭
- **ComponentLogger**: 在 `pkg/logging` 添加组件级别日志记录器，支持 `ForComponent()` 创建
- **Printf 兼容方法**: 添加 `Printf` 方法便于从 `log.Printf` 迁移

### Changed

- **结构化日志迁移**: 将 `pkg/` 下所有 `log.Printf` 调用迁移到结构化日志
  - `pkg/agent/` - agent.go, actor.go, streaming.go, processor.go, model_fallback.go, tool_manager.go, session.go
  - `pkg/provider/` - anthropic.go, deepseek.go, glm.go, openai_compatible.go
  - `pkg/middleware/` - 14个中间件文件
  - `pkg/events/` - bus.go
  - `pkg/actor/` - system.go
  - `pkg/skills/` - injector.go, manager.go
  - `pkg/workflow/` - actor_engine.go
  - `pkg/mcpserver/` - docstools.go
  - `pkg/a2a/` - server.go
  - `pkg/tools/builtin/` - ask_user.go, write.go
  - `pkg/core/` - scheduler.go, room.go
  - `pkg/memory/` - lineage.go
  - `pkg/memory/logic/` - consolidation.go

### Fixed

- **randomString 性能优化**: 修复 `pkg/events/bus.go` 中低效的 `randomString()` 实现，从 `time.Sleep` 循环改为 `crypto/rand`

### Tests

- 添加 EventBus 清理功能的 8 个测试用例

## [v0.15.0] - 2025-11-24

### Added

- 完成15个工具的全面测试验证
- 添加工具测试文档和报告

### Fixed

- **WebSearch工具**: 修复search_depth参数问题，从"general"改为"basic"以符合Tavily API规范
- 验证多轮推理功能正常工作（streaming.go）

### Tested

- 网络工具: HttpRequest ✅, WebSearch ✅
- 文件工具: Read ✅, Write ✅, Edit ✅, Glob ✅, Grep ✅
- 执行工具: Bash ✅, BashOutput ✅, KillShell ✅
- 任务管理: TodoWrite ✅, Task ✅, ExitPlanMode ✅
- 高级工具: DemoLongTask ✅, Skill ⚠️, SemanticSearch ⚠️

### Notes

- Skill和SemanticSearch工具需要额外配置才能完整使用
- 所有核心工具调用功能已验证正常
- 系统可投入实际使用

## [v0.14.0] - Previous Release

- 基础工具实现
- 多轮推理支持
