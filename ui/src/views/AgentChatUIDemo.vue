<template>
<div class="agent-chatui-demo">
  <div class="demo-container">
    <!-- 侧边栏 -->
    <div class="demo-sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">Aster Agent</h2>
        <p class="sidebar-subtitle">ChatUI + Tool Stream</p>
        <div class="ws-status" :class="{ online: wsConnected }">
          <span class="dot"></span>{{ wsConnected ? 'WS Connected' : 'WS Disconnected' }}
        </div>
      </div>
      
      <div class="agent-selector">
        <div
          v-for="agent in agents"
          :key="agent.id"
          :class="['agent-item', { active: selectedAgent?.id === agent.id }]"
          @click="selectAgent(agent)"
        >
          <div class="agent-avatar">
            <div class="avatar-placeholder">{{ agent.name[0] }}</div>
          </div>
          <div class="agent-info">
            <div class="agent-name">{{ agent.name }}</div>
            <div class="agent-desc">{{ agent.description }}</div>
          </div>
          <div :class="['agent-status', `status-${agent.status}`]"></div>
        </div>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="demo-chat">
      <Chat
        :messages="messages"
        :placeholder="`与 ${selectedAgent?.name || 'Agent'} 对话...`"
        :disabled="isThinking"
        :quick-replies="quickReplies"
        :toolbar="toolbar"
        @send="handleSend"
        @quick-reply="handleQuickReply"
        @card-action="handleCardAction"
      />

      <!-- 工具流展示 -->
      <div class="tool-stream" v-if="toolRunsList.length">
        <div class="tool-stream-header">
          <h3>工具执行</h3>
          <span class="hint">实时状态 / 可取消</span>
        </div>
        <div class="tool-run" v-for="run in toolRunsList" :key="run.tool_call_id">
          <div class="tool-run-head">
            <div class="tool-name">{{ run.name }}</div>
            <div class="tool-state" :class="run.state">{{ run.state }}</div>
          </div>
          <div class="tool-progress">
            <div class="bar">
              <div class="bar-inner" :style="{ width: `${Math.round((run.progress || 0)*100)}%` }"></div>
            </div>
            <div class="meta">
              <span>{{ Math.round((run.progress || 0)*100) }}%</span>
              <span v-if="run.message">{{ run.message }}</span>
            </div>
          </div>
          <div class="tool-actions">
            <button v-if="run.cancelable && run.state === 'executing'" @click="controlTool(run.tool_call_id, 'cancel')">取消</button>
            <button v-if="run.pausable && run.state === 'executing'" @click="controlTool(run.tool_call_id, 'pause')">暂停</button>
            <button v-if="run.pausable && run.state === 'paused'" @click="controlTool(run.tool_call_id, 'resume')">继续</button>
          </div>
          <pre v-if="run.result" class="tool-result">{{ formatResult(run.result) }}</pre>
          <pre v-if="run.error" class="tool-error">Error: {{ run.error }}</pre>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Chat } from '@/components/ChatUI';
import { useAsterClient } from '@/composables/useAsterClient';
import { generateId } from '@/utils/format';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'thinking' | 'busy';
}

interface Message {
  id: string;
  type: 'text' | 'thinking' | 'typing' | 'card' | 'file';
  content?: string;
  position: 'left' | 'right';
  status?: 'pending' | 'sent' | 'error';
  conversationId?: string; // 添加对话ID
  user?: {
    avatar?: string;
    name?: string;
  };
  card?: {
    title: string;
    content: string;
    actions?: Array<{ text: string; value: string }>;
  };
}

const { client, ensureWebSocket, onMessage, isConnected } = useAsterClient();
const wsConnected = isConnected;

// 模拟 Agent 列表
const agents = ref<Agent[]>([
  {
    id: '1',
    name: '写作助手',
    description: '帮助你创作优质内容',
    status: 'idle',
  },
  {
    id: '2',
    name: '代码助手',
    description: '编程问题解答专家',
    status: 'idle',
  },
  {
    id: '3',
    name: '数据分析师',
    description: '数据洞察与可视化',
    status: 'idle',
  },
]);

const selectedAgent = ref<Agent>(agents.value[0]);
const messages = ref<Message[]>([]);

const isThinking = ref(false);
const toolRuns = ref<Record<string, any>>({});
let unsubscribeFn: (() => void) | null = null;
let currentConversationId = ref<string>(''); // 跟踪当前对话回合

const quickReplies = computed(() => [
  { name: '帮我写一篇文章', value: 'write_article' },
  { name: '分析这段代码', value: 'analyze_code' },
  { name: '生成工作流', value: 'create_workflow' },
]);

const toolbar = [
  {
    icon: 'image',
    onClick: () => console.log('上传图片'),
  },
  {
    icon: 'attach',
    onClick: () => console.log('上传文件'),
  },
  {
    icon: 'mic',
    onClick: () => console.log('语音输入'),
  },
];

const selectAgent = (agent: Agent) => {
  selectedAgent.value = agent;
  messages.value = [
    {
      id: generateId('greeting'),
      type: 'text',
      content: `你好！我是${agent.name}，${agent.description}。`,
      position: 'left',
      user: {
        name: agent.name,
      },
    },
  ];
};

const handleSend = async (message: { type: string; content: string }) => {
  // 为新对话生成新的对话ID
  currentConversationId.value = generateId('conversation');

  // 添加用户消息
  const userMsg: Message = {
    id: generateId('user'),
    type: 'text',
    content: message.content,
    position: 'right',
    status: 'sent',
  };
  messages.value.push(userMsg);

  // 显示思考状态
  isThinking.value = true;
  const thinkingMsg: Message = {
    id: generateId('thinking'),
    type: 'thinking',
    position: 'left',
  };
  messages.value.push(thinkingMsg);

  try {
    const ws = await ensureWebSocket();
    if (!ws) {
      throw new Error('WebSocket not connected');
    }
    ws.send({
      type: 'chat',
      payload: {
        input: message.content,
        template_id: 'chat',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    messages.value = messages.value.filter(m => !m.id.startsWith('thinking-'));
    messages.value.push({
      id: generateId('error'),
      type: 'text',
      content: '抱歉，处理请求时出错了。请检查后端服务是否正常运行。',
      position: 'left',
      status: 'error',
    });
    isThinking.value = false;
  }
};

const handleQuickReply = (reply: { name: string; value?: string }) => {
  handleSend({
    type: 'text',
    content: reply.name,
  });
};

const handleCardAction = (action: { value: string }) => {
  console.log('Card action:', action);
};

// 处理 WS 入站消息
const handleWsMessage = (msg: any) => {
  if (!msg) return;
  switch (msg.type) {
    case 'text_delta': {
      const delta = msg.payload?.text || msg.payload?.delta || '';
      if (!delta) return;

      // 第一次收到文本时，移除thinking消息
      if (messages.value.some(m => m.type === 'thinking')) {
        messages.value = messages.value.filter(m => m.type !== 'thinking');
      }

      // 查找属于当前对话的最后一个AI回复消息
      let last: Message | undefined;
      for (let i = messages.value.length - 1; i >= 0; i--) {
        const m = messages.value[i];
        // 查找属于当前对话的AI消息
        if (m.position === 'left' && m.type === 'text' &&
            m.status !== 'system' && !m.id.includes('welcome') &&
            m.conversationId === currentConversationId.value) {
          last = m;
          break;
        }
      }
      if (!last) {
        // 如果没有找到当前对话的消息，创建新的
        last = {
          id: generateId('assistant-' + currentConversationId.value),
          type: 'text',
          content: '',
          position: 'left',
          user: { name: selectedAgent.value.name },
          conversationId: currentConversationId.value,
        };
        messages.value.push(last);
      }
      last.content = (last.content || '') + delta;
      break;
    }
    case 'chat_complete': {
      isThinking.value = false;
      messages.value = messages.value.filter(m => !m.id.startsWith('thinking-'));
      break;
    }
    case 'agent_event': {
      const ev = msg.payload?.event;
      const evType = msg.payload?.type || ev?.type || ev?.EventType;
      if (!ev || !evType) return;
      handleAgentEvent(evType, ev);
      break;
    }
    default:
      break;
  }
};

const handleAgentEvent = (type: string, ev: any) => {
  // Tool events
  if (type.startsWith('tool')) {
    const call = ev.Call || ev.call || {};
    const id = call.id || call.ID || call.tool_call_id;
    if (!id) return;
    const prev = toolRuns.value[id] || {};
    const progress = ev.progress ?? call.progress ?? prev.progress ?? 0;
    const state = call.state || ev.state || prev.state || 'executing';
    toolRuns.value = {
      ...toolRuns.value,
      [id]: {
        tool_call_id: id,
        name: call.name || prev.name,
        state,
        progress,
        message: ev.message || prev.message,
        result: call.result || ev.result || prev.result,
        error: ev.error || call.error || prev.error,
        cancelable: call.cancelable ?? prev.cancelable,
        pausable: call.pausable ?? prev.pausable,
      },
    };
  }
};

const controlTool = async (toolCallId: string, action: 'cancel' | 'pause' | 'resume') => {
  try {
    const ws = await ensureWebSocket();
    if (!ws) return;
    ws.send({
      type: 'tool:control',
      payload: {
        tool_call_id: toolCallId,
        action,
      },
    });
  } catch (err) {
    console.error('control tool failed', err);
  }
};

const toolRunsList = computed(() => Object.values(toolRuns.value));

const formatResult = (res: any) => {
  try {
    return typeof res === 'string' ? res : JSON.stringify(res, null, 2);
  } catch {
    return String(res);
  }
};

onMounted(async () => {
  // 初始化时选中第一个agent并显示欢迎消息
  selectAgent(selectedAgent.value);

  await ensureWebSocket();
  if (unsubscribeFn) unsubscribeFn();
  unsubscribeFn = onMessage(handleWsMessage);
});

onBeforeUnmount(() => {
  if (unsubscribeFn) unsubscribeFn();
});
</script>

<style scoped>
.agent-chatui-demo {
  @apply min-h-screen bg-gray-50 dark:bg-gray-900;
}

.demo-container {
  @apply h-screen flex;
}

.demo-sidebar {
  @apply w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col;
}

.sidebar-header {
  @apply p-6 border-b border-gray-200 dark:border-gray-700;
}

.sidebar-title {
  @apply text-2xl font-bold text-gray-900 dark:text-white;
}

.sidebar-subtitle {
  @apply text-sm text-gray-500 dark:text-gray-400 mt-1;
}

.agent-selector {
  @apply flex-1 overflow-y-auto p-4 space-y-2;
}

.agent-item {
  @apply flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700;
}

.agent-item.active {
  @apply bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800;
}

.agent-avatar {
  @apply w-10 h-10 rounded-full overflow-hidden flex-shrink-0;
}

.avatar-placeholder {
  @apply w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg;
}

.agent-info {
  @apply flex-1 min-w-0;
}

.agent-name {
  @apply text-sm font-semibold text-gray-900 dark:text-white truncate;
}

.agent-desc {
  @apply text-xs text-gray-500 dark:text-gray-400 truncate;
}

.agent-status {
  @apply w-2 h-2 rounded-full flex-shrink-0;
}

.status-idle {
  @apply bg-green-500;
}

.status-thinking {
  @apply bg-blue-500 animate-pulse;
}

.status-busy {
  @apply bg-amber-500 animate-pulse;
}

.demo-chat {
  @apply flex-1 flex flex-col;
}
</style>
