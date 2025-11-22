<template>
  <div class="agent-chatui-demo">
    <div class="demo-container">
      <!-- 侧边栏 -->
      <div class="demo-sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Aster Agent</h2>
          <p class="sidebar-subtitle">ChatUI 风格演示</p>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Chat } from '@/components/ChatUI';
import { useAsterClient } from '@/composables/useAsterClient';

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

const { client } = useAsterClient();

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
const messages = ref<Message[]>([
  {
    id: '1',
    type: 'text',
    content: '你好！我是 Aster Agent，有什么可以帮助你的吗？',
    position: 'left',
    user: {
      avatar: '',
      name: 'Agent',
    },
  },
]);

const isThinking = ref(false);

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
      id: Date.now().toString(),
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
  // 添加用户消息
  const userMsg: Message = {
    id: Date.now().toString(),
    type: 'text',
    content: message.content,
    position: 'right',
    status: 'sent',
  };
  messages.value.push(userMsg);

  // 显示思考状态
  isThinking.value = true;
  const thinkingMsg: Message = {
    id: `thinking-${Date.now()}`,
    type: 'thinking',
    content: '正在分析你的问题...',
    position: 'left',
  };
  messages.value.push(thinkingMsg);

  try {
    // 使用 chatDirect 方法（无需预先创建 Agent）
    const response = await client.agents.chatDirect(message.content, 'chat');
    
    // 移除思考消息
    messages.value = messages.value.filter(m => m.id !== thinkingMsg.id);
    
    // 添加 Agent 回复
    const agentMsg: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: response.text || response.output || '抱歉，我现在无法回答。',
      position: 'left',
      user: {
        name: selectedAgent.value.name,
      },
    };
    messages.value.push(agentMsg);
  } catch (error) {
    console.error('Chat error:', error);
    
    // 移除思考消息
    messages.value = messages.value.filter(m => m.id !== thinkingMsg.id);
    
    // 显示错误消息
    const errorMsg: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: '抱歉，处理请求时出错了。请检查后端服务是否正常运行。',
      position: 'left',
      status: 'error',
    };
    messages.value.push(errorMsg);
  } finally {
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
