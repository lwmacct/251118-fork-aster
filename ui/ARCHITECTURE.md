# AsterUI 架构设计

## 概述

AsterUI 是 Aster 框架的官方 Web UI SDK，基于 Vue3 + TypeScript 构建，直接使用 `@aster/client-js` SDK，提供开箱即用的 AI Agent 交互界面。

---

## 设计原则

### 1. SDK 优先

**不重复造轮子**：直接使用已完成的 `@aster/client-js` SDK，而不是重新实现 API 调用逻辑。

```typescript
// ❌ 错误：重新实现 API
const response = await fetch('/v1/agents/chat', { ... });

// ✅ 正确：使用 SDK
const response = await client.agents.chat(agentId, request);
```

### 2. 组件化设计

**可复用的 UI 组件**：每个组件都是独立的，可以单独使用或组合使用。

```
AsterChat (完整对话界面)
├── MessageItem (消息组件)
│   └── ThinkingBlock (思考过程)
├── InputArea (输入区域)
└── Header (头部)
```

### 3. Composable 优先

**Vue3 Composition API**：使用 Composables 封装业务逻辑，便于复用和测试。

```typescript
// useChat: 对话逻辑
// useAsterClient: SDK 封装
// useWebSocket: WebSocket 管理
```

### 4. 类型安全

**TypeScript 全覆盖**：所有代码都使用 TypeScript，确保类型安全。

---

## 架构层次

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Vue Components (UI 层)                    │
│  ├── AsterChat.vue                                  │
│  ├── MessageItem.vue                                │
│  ├── ThinkingBlock.vue                              │
│  └── ...                                            │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Layer 2: Composables (业务逻辑层)                  │
│  ├── useChat.ts (对话逻辑)                          │
│  ├── useAsterClient.ts (SDK 封装)                   │
│  └── useWebSocket.ts (WebSocket 管理)               │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Layer 3: @aster/client-js (SDK 层)                 │
│  ├── aster (主客户端)                               │
│  ├── WebSocketClient (WebSocket)                    │
│  ├── SubscriptionManager (事件订阅)                 │
│  └── Resources (Agent/Memory/Workflow...)           │
└────────────────┬────────────────────────────────────┘
                 │ HTTP/WebSocket
┌────────────────▼────────────────────────────────────┐
│  Layer 4: Aster Server (后端)                       │
│  ├── server/ (HTTP API)                             │
│  ├── pkg/asteros/ (AsterOS)                         │
│  └── pkg/core/ (Pool/Room)                          │
└─────────────────────────────────────────────────────┘
```

---

## 核心模块

### 1. useAsterClient

**职责**：封装 `@aster/client-js` SDK，提供 Vue3 响应式接口。

```typescript
export function useAsterClient(config: AsterClientConfig) {
  const client = new aster({ baseUrl, apiKey });
  const ws = ref<WebSocketClient | null>(null);
  const isConnected = ref(false);
  
  // 初始化 WebSocket
  const initWebSocket = async () => {
    ws.value = new WebSocketClient({ ... });
    await ws.value.connect(wsUrl);
    isConnected.value = true;
  };
  
  // 订阅事件
  const subscribe = (channels, filter) => {
    return subscriptionManager.value.subscribe(channels, filter);
  };
  
  return { client, isConnected, subscribe };
}
```

### 2. useChat

**职责**：管理对话状态和消息流。

```typescript
export function useChat(config: ChatConfig) {
  const messages = ref<Message[]>([]);
  const isThinking = ref(false);
  
  const { client, subscribe } = useAsterClient(config);
  
  const sendMessage = async (content: string) => {
    // 1. 添加用户消息
    messages.value.push({ role: 'user', content });
    
    // 2. 调用 SDK 流式 Chat
    const stream = client.agents.chatStream(agentId, { message: content });
    
    // 3. 订阅三通道事件
    const subscription = subscribe(['progress', 'control', 'monitor']);
    
    // 4. 处理事件
    for await (const envelope of subscription) {
      handleEvent(envelope.event);
    }
  };
  
  return { messages, sendMessage, isThinking };
}
```

### 3. AsterChat.vue

**职责**：完整的对话界面组件。

```vue
<template>
  <div class="aster-chat">
    <!-- Header -->
    <div class="header">...</div>
    
    <!-- Messages -->
    <div class="messages">
      <MessageItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </div>
    
    <!-- Input -->
    <div class="input">...</div>
  </div>
</template>

<script setup>
const { messages, sendMessage } = useChat(props.config);
</script>
```

---

## 事件流

### 三通道事件系统

Aster 使用三通道事件系统，AsterUI 完整支持：

```
Progress Channel (数据流)
├── thinking (思考过程)
├── text_chunk (流式文本)
├── tool_start (工具开始)
├── tool_end (工具结束)
├── done (完成)
└── error (错误)

Control Channel (审批流)
├── tool_approval_request (审批请求)
├── tool_approval_response (审批响应)
├── pause (暂停)
└── resume (恢复)

Monitor Channel (治理流)
├── token_usage (Token 使用)
├── latency (延迟)
├── cost (成本)
└── compliance (合规)
```

### 事件处理流程

```typescript
// 1. 订阅事件
const subscription = subscribe(['progress', 'control', 'monitor'], {
  agentId: 'agent-123',
});

// 2. 处理事件
for await (const envelope of subscription) {
  const event = envelope.event;
  
  if (isProgressEvent(event)) {
    // 处理 Progress 事件
    if (isEventType(event, 'thinking')) {
      // 添加思考过程到 UI
    } else if (isEventType(event, 'text_chunk')) {
      // 更新流式文本
    }
  } else if (isControlEvent(event)) {
    // 处理 Control 事件
    if (isEventType(event, 'tool_approval_request')) {
      // 显示审批 UI
    }
  }
}
```

---

## 数据流

### 发送消息流程

```
User Input
    ↓
sendMessage()
    ↓
client.agents.chatStream()
    ↓
WebSocket → Aster Server
    ↓
Agent 处理
    ↓
三通道事件 ← WebSocket
    ↓
handleEvent()
    ↓
更新 UI (messages.value)
```

### 审批流程

```
Agent 请求工具调用
    ↓
tool_approval_request 事件
    ↓
显示审批 UI (ThinkingBlock)
    ↓
用户点击批准/拒绝
    ↓
approveAction() / rejectAction()
    ↓
client.security.approve/reject()
    ↓
Agent 继续/停止执行
```

---

## 技术栈

### 前端

- **Vue 3.4+** - 渐进式 JavaScript 框架
- **TypeScript 5.3+** - 类型安全
- **Vite 5.0+** - 快速构建工具
- **Tailwind CSS 3.4+** - 实用优先的 CSS 框架
- **Pinia 2.1+** - Vue 状态管理（可选）
- **Marked 11.0+** - Markdown 渲染

### SDK

- **@aster/client-js** - Aster 官方 JavaScript SDK
  - WebSocket 客户端
  - 三通道事件系统
  - 完整的 REST API 封装

---

## 扩展性

### 1. 自定义组件

```vue
<template>
  <AsterChat :config="config">
    <template #message="{ message }">
      <!-- 自定义消息渲染 -->
      <CustomMessage :message="message" />
    </template>
  </AsterChat>
</template>
```

### 2. 自定义主题

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
      },
    },
  },
}
```

### 3. 插件系统（计划中）

```typescript
// 注册插件
app.use(AsterUIPlugin, {
  plugins: [
    VoiceInputPlugin,
    ImageUploadPlugin,
    CustomThemePlugin,
  ],
});
```

---

## 性能优化

### 1. 虚拟滚动

对于长消息列表，使用虚拟滚动：

```vue
<VirtualScroller :items="messages" :item-height="100">
  <template #default="{ item }">
    <MessageItem :message="item" />
  </template>
</VirtualScroller>
```

### 2. 懒加载

按需加载组件：

```typescript
const RoomView = defineAsyncComponent(() => import('./RoomView.vue'));
const WorkflowView = defineAsyncComponent(() => import('./WorkflowView.vue'));
```

### 3. 事件节流

对高频事件进行节流：

```typescript
const handleTextChunk = throttle((delta: string) => {
  message.content += delta;
}, 50);
```

---

## 测试策略

### 1. 单元测试

```typescript
describe('useChat', () => {
  it('should send message', async () => {
    const { sendMessage, messages } = useChat({ agentId: 'test' });
    await sendMessage('Hello');
    expect(messages.value).toHaveLength(2); // user + assistant
  });
});
```

### 2. 组件测试

```typescript
describe('AsterChat', () => {
  it('should render messages', () => {
    const wrapper = mount(AsterChat, {
      props: { config: { agentId: 'test' } },
    });
    expect(wrapper.find('.message-item')).toBeTruthy();
  });
});
```

### 3. E2E 测试

```typescript
test('complete chat flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('textarea', 'Hello');
  await page.click('button[type="submit"]');
  await expect(page.locator('.message-item')).toHaveCount(2);
});
```

---

## 未来计划

### Phase 1 (当前)
- ✅ 基础对话界面
- ✅ Think-Aloud 可视化
- ✅ Human-in-the-Loop
- ✅ 流式响应

### Phase 2
- ⏳ Room 协作界面
- ⏳ Workflow 监控界面
- ⏳ Pool 管理界面
- ⏳ 多模态支持（语音、图片）

### Phase 3
- ⏳ 移动端适配
- ⏳ 离线支持
- ⏳ 插件系统
- ⏳ 主题市场

---

## 参考资料

- [Aster Client SDK](../client-sdks/client-js/README.md)
- [Aster Server API](../server/README.md)
- [Vue 3 文档](https://vuejs.org/)
- [Tailwind CSS 文档](https://tailwindcss.com/)

---

**AsterUI - 让 AI Agent 可视化变得简单！** 🎨
