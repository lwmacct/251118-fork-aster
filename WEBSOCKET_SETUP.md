# WebSocket 集成完成

## 实现内容

### 后端 (Go)

1. **WebSocket 处理器** (`server/handlers/websocket.go`)
   - 支持 WebSocket 连接管理
   - 实现消息路由（chat、ping/pong）
   - 自动重连和心跳检测
   - 流式响应支持

2. **路由配置** (`server/server.go`, `server/routes.go`)
   - WebSocket 端点：`ws://localhost:8080/v1/ws`
   - 统计端点：`GET /v1/ws/stats`

3. **依赖**
   - 添加 `github.com/gorilla/websocket v1.5.3`

### 前端 (Vue/TypeScript)

1. **Composable 更新** (`ui/src/composables/useAsterClient.ts`)
   - 启用 WebSocket 连接
   - 自动构建 WebSocket URL
   - 支持重连和订阅管理

## 测试

运行测试脚本：
```bash
node test-websocket.js
```

## 使用示例

### WebSocket 消息格式

**发送聊天消息：**
```json
{
  "type": "chat",
  "payload": {
    "template_id": "chat",
    "input": "你的问题",
    "model_config": {
      "provider": "deepseek",
      "model": "deepseek-chat"
    }
  }
}
```

**接收响应：**
```json
{"type": "chat_start", "payload": {"agent_id": "..."}}
{"type": "text_delta", "payload": {"text": "响应内容"}}
{"type": "chat_complete", "payload": {"agent_id": "..."}}
```

## 启动服务器

```bash
PROVIDER=deepseek \
MODEL=deepseek-chat \
DEEPSEEK_API_KEY=your-key \
go run ./cmd/aster-server
```

服务器将在 `http://localhost:8080` 启动，WebSocket 端点为 `ws://localhost:8080/v1/ws`。
