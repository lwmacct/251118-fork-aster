# 最终测试清单

## 修复内容

### 1. WebSocket 单例模式 ✅
**文件**: `ui/src/composables/useWebSocket.ts`
- 创建全局单例 WebSocket 管理器
- 确保整个应用只有一个 WebSocket 连接
- 添加状态监听和日志

### 2. useChat 更新 ✅
**文件**: `ui/src/composables/useChat.ts`
- 使用 `useWebSocket` 单例
- 修复变量引用错误（`isConnected` → `wsConnected`）
- 添加详细的调试日志

### 3. 错误修复 ✅
- 修复 `ReferenceError: isConnected is not defined`
- 修复 WebSocket 实例获取问题

## 测试步骤

### 1. 刷新浏览器
```
Cmd+Shift+R (Mac) 或 Ctrl+Shift+R (Windows/Linux)
```

### 2. 打开开发者工具
```
F12 或 右键 → 检查
```

### 3. 查看控制台日志
应该看到：
```
🚀 Initializing WebSocket connection to: ws://localhost:8080/v1/ws
🔌 Creating new WebSocket connection to: ws://localhost:8080/v1/ws
📡 WebSocket state changed: CONNECTING
📡 WebSocket state changed: CONNECTED
✅ WebSocket connected successfully
✅ WebSocket initialized in useChat
```

### 4. 输入消息并发送
在聊天框输入"你好"并按 Enter 或点击发送按钮

### 5. 检查日志输出
应该看到：
```
🚀 handleSend called with: 你好
📤 sendMessage called with: 你好
📊 isDemoMode: false
📊 wsConnected: true
📊 ws instance: WebSocketClient {...}
✅ User message added to messages array
🔍 Checking WebSocket availability: {ws exists: true, isConnected: true, ...}
✅ Using WebSocket for chat
📤 Sending WebSocket message: {type: 'chat', payload: {...}}
✅ Message sent to WebSocket
📥 WebSocket message: {type: 'chat_start', payload: {...}}
📥 WebSocket message: {type: 'text_delta', payload: {text: '...'}}
📥 WebSocket message: {type: 'text_delta', payload: {text: '...'}}
...
📥 WebSocket message: {type: 'chat_complete', payload: {...}}
```

### 6. 验证 UI 显示
- ✅ 用户消息显示为蓝色气泡
- ✅ 助手消息显示为深色气泡
- ✅ 助手消息内容逐字显示（流式）
- ✅ 消息完成后显示时间戳

## 预期结果

### 成功标志
1. ✅ 没有控制台错误
2. ✅ WebSocket 连接成功
3. ✅ 消息发送成功
4. ✅ 收到流式响应
5. ✅ UI 正确显示消息内容

### 如果还有问题

#### 问题 A: WebSocket 连接失败
**检查**:
- 服务器是否运行在 `http://localhost:8080`
- 浏览器控制台是否有 CORS 错误
- 网络标签页中 WebSocket 连接状态

**解决**:
```bash
# 重启服务器
lsof -ti:8080 | xargs kill -9
PROVIDER=deepseek MODEL=deepseek-chat DEEPSEEK_API_KEY=your-key go run ./cmd/aster-server
```

#### 问题 B: 消息发送但无响应
**检查**:
- 服务器日志是否收到消息
- DeepSeek API Key 是否有效
- 服务器是否有错误日志

**解决**:
```bash
# 检查服务器日志
# 应该看到: [Agent Stream] Starting stream for message: ...
```

#### 问题 C: UI 不显示消息
**检查**:
- 浏览器控制台是否有 Vue 警告
- 消息数组是否更新（在 Vue DevTools 中查看）
- CSS 样式是否正确加载

**解决**:
- 清除浏览器缓存
- 使用无痕模式测试
- 检查 `message.content.text` 是否有值

## 服务器状态检查

### 检查服务器是否运行
```bash
curl http://localhost:8080/health
```

### 检查 WebSocket 统计
```bash
curl -H "X-API-Key: dev-key-12345" http://localhost:8080/v1/ws/stats
```

### 测试 HTTP API（备用）
```bash
curl -X POST http://localhost:8080/v1/agents/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-12345" \
  -d '{
    "template_id": "chat",
    "input": "你好"
  }'
```

## 成功案例

如果一切正常，你应该看到类似这样的对话：

```
用户: 你好
助手: 你好！我是一个AI助手，可以帮助你处理各种任务...
```

消息应该流畅地逐字显示，没有延迟或卡顿。

## 下一步

如果测试成功：
1. 🎉 恭喜！WebSocket 集成完成
2. 可以开始使用实时聊天功能
3. 可以测试更复杂的对话场景

如果测试失败：
1. 截图控制台完整日志
2. 截图网络标签页 WebSocket 连接
3. 提供服务器日志
4. 描述具体的错误现象
