/**
 * useChat Composable
 * 管理 Chat 对话逻辑
 */

import { ref, onMounted, reactive } from 'vue';
import type { Message, ChatConfig, TextMessage, Agent } from '@/types';
import { useAsterClient } from './useAsterClient';
import { useWebSocket } from './useWebSocket';
import { generateId } from '@/utils/format';

export function useChat(config: ChatConfig) {
  const messages = ref<Message[]>([]);
  const isTyping = ref(false);
  const currentInput = ref('');
  const demoConnection = ref(true);
  const isDemoMode = config.demoMode ?? true;
  const agent = ref<Agent>({
    id: config.agentId || 'demo-agent',
    name: config.agentProfile?.name || 'Aster Copilot',
    description: config.agentProfile?.description || '多模态执行、自动规划、符合企业安全的 Agent',
    avatar: config.agentProfile?.avatar,
    status: 'idle',
    metadata: {
      model: 'aster:builder',
    },
  });
  const demoCursor = ref(0);

  const { client } = useAsterClient({
    baseUrl: config.apiUrl || 'http://localhost:8080',
    apiKey: config.apiKey,
  });
  
  const { connect, getInstance, isConnected: wsConnected } = useWebSocket();
  const connectionState = isDemoMode ? demoConnection : wsConnected;

  // 初始化 WebSocket 连接
  onMounted(async () => {
    if (!isDemoMode) {
      const baseUrl = config.apiUrl || 'http://localhost:8080';
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/v1/ws';
      console.log('🚀 Initializing WebSocket connection to:', wsUrl);
      try {
        await connect(wsUrl);
        console.log('✅ WebSocket initialized in useChat');
      } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
      }
    }
  });

  const fallbackResponses = [
    '我已经为你生成了一个新的多 Agent 工作流，包含大纲、评价器和部署策略。',
    'Aster 的沙箱已准备好，所有写入都被限制在 /workspace 目录，你可以放心执行指令。',
    '我为这个会话自动挂载了上下文记忆，后续可以直接引用历史工单。',
    'Streaming 模式已打开，等待后端返回 token，平均延迟 220ms。',
  ];

  const pickDemoResponse = (content: string) => {
    const list = config.demoResponses?.length ? config.demoResponses : fallbackResponses;
    const index = demoCursor.value % list.length;
    demoCursor.value += 1;
    const template = list[index];
    return template.includes('{question}')
      ? template.split('{question}').join(content)
      : template;
  };

  // 发送消息
  const sendMessage = async (content: string) => {
    console.log('📤 sendMessage called with:', content);
    console.log('📊 isDemoMode:', isDemoMode);
    console.log('📊 wsConnected:', wsConnected.value);
    console.log('📊 ws instance:', getInstance());
    
    if (!content.trim()) return;

    // 添加用户消息
    const userMessage: TextMessage = {
      id: generateId('msg'),
      type: 'text',
      role: 'user',
      content: { text: content },
      createdAt: Date.now(),
      status: 'pending',
    };
    messages.value.push(userMessage);
    console.log('✅ User message added to messages array');

    // 创建 AI 响应占位（使用 reactive 确保响应式）
    const assistantMessage: TextMessage = reactive({
      id: generateId('msg'),
      type: 'text',
      role: 'assistant',
      content: { text: '' },
      createdAt: Date.now(),
    }) as TextMessage;
    messages.value.push(assistantMessage);
    console.log('✅ Assistant message placeholder added');

    isTyping.value = true;
    agent.value.status = 'thinking';
    userMessage.status = 'sent';
    currentInput.value = '';

    try {
      if (isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, config.demoDelay ?? 800));
        assistantMessage.content.text = pickDemoResponse(content);
        assistantMessage.status = 'sent';
        isTyping.value = false;
        agent.value.status = 'idle';
      } else {
        const ws = getInstance();
        console.log('🔍 Checking WebSocket availability:', {
          'ws exists': !!ws,
          'isConnected': wsConnected.value,
          'ws type': ws?.constructor?.name,
        });
        
        // 使用 WebSocket 进行流式对话
        if (ws && wsConnected.value) {
          console.log('✅ Using WebSocket for chat');
          
          // 监听 WebSocket 消息
          const unsubscribe = ws.onMessage((message: any) => {
            console.log('📥 WebSocket message:', message);
            
            if (message.type === 'text_delta' && message.payload?.text) {
              assistantMessage.content.text += message.payload.text;
              console.log('📝 Updated text:', assistantMessage.content.text.substring(0, 50) + '...');
            } else if (message.type === 'chat_complete') {
              assistantMessage.status = 'sent';
              isTyping.value = false;
              agent.value.status = 'idle';
              unsubscribe();
              
              // 触发回调
              if (config.onReceive) {
                config.onReceive(assistantMessage);
              }
            } else if (message.type === 'error') {
              assistantMessage.content.text = `❌ ${message.payload?.message || '发送失败'}`;
              userMessage.status = 'error';
              isTyping.value = false;
              agent.value.status = 'idle';
              unsubscribe();
              if (config.onError) {
                config.onError(new Error(message.payload?.message));
              }
            }
          });

          // 发送聊天消息
          const message = {
            type: 'chat',
            payload: {
              template_id: config.agentId || 'chat',
              input: content,
              model_config: config.modelConfig,
            },
          };
          
          console.log('📤 Sending WebSocket message:', message);
          ws.send(message);
          console.log('✅ Message sent to WebSocket');
          
          // WebSocket 是异步的，不需要等待这里
          // 状态会在消息回调中更新
        } else {
          // 回退到 HTTP API
          console.log('⚠️ WebSocket not connected, using HTTP API');
          const response = await client.agents.chat({
            template_id: config.agentId || 'chat',
            input: content,
          } as any);

          assistantMessage.content.text = response.text || '无响应';
          assistantMessage.status = 'sent';
          isTyping.value = false;
          agent.value.status = 'idle';
        }
      }
    } catch (error: any) {
      console.error('Send message error:', error);
      
      assistantMessage.content.text = `❌ 发送失败: ${error.message || '未知错误'}`;
      userMessage.status = 'error';
      isTyping.value = false;
      agent.value.status = 'idle';

      if (config.onError) {
        config.onError(error);
      }
    }

    // 触发回调
    if (config.onSend) {
      config.onSend(userMessage);
    }
    if (config.onReceive && assistantMessage.content.text) {
      config.onReceive(assistantMessage);
    }
  };

  // 发送图片
  const sendImage = async (file: File) => {
    // TODO: 实现图片上传
    console.log('Send image:', file.name);
    
    // 创建图片消息占位
    const imageMessage: Message = {
      id: generateId('msg'),
      type: 'image',
      role: 'user',
      content: {
        url: URL.createObjectURL(file),
        alt: file.name,
      },
      createdAt: Date.now(),
      status: 'pending',
    };
    messages.value.push(imageMessage);

    // TODO: 上传到服务器并获取 URL
    // 当前只是本地预览
    imageMessage.status = 'sent';
  };

  // 重试消息
  const retryMessage = async (message: Message) => {
    if (message.type === 'text' && message.role === 'user') {
      await sendMessage(message.content.text);
    }
  };

  // 删除消息
  const deleteMessage = (messageId: string) => {
    const index = messages.value.findIndex(m => m.id === messageId);
    if (index !== -1) {
      messages.value.splice(index, 1);
    }
  };

  // 清空消息
  const clearMessages = () => {
    messages.value = [];
  };

  // 初始化
  onMounted(() => {
    // 添加欢迎消息
    if (config.welcomeMessage && messages.value.length === 0) {
      const welcomeText =
        typeof config.welcomeMessage === 'string'
          ? config.welcomeMessage
          : config.welcomeMessage.type === 'text'
            ? config.welcomeMessage.content.text
            : '👋 你好，我是 Aster Copilot。';

      const welcomeMsg: TextMessage = {
        id: generateId('msg'),
        type: 'text',
        role: 'assistant',
        content: {
          text: welcomeText,
        },
        createdAt: Date.now(),
      };
      messages.value.push(welcomeMsg);
    }
  });

  return {
    // 状态
    messages,
    isTyping,
    isConnected: wsConnected,
    currentInput,
    agent,
    isThinking: isTyping,

    // 方法
    sendMessage,
    sendImage,
    retryMessage,
    deleteMessage,
    clearMessages,
    approveAction: (requestId: string) => {
      config.onApproveAction?.(requestId);
    },
    rejectAction: (requestId: string) => {
      config.onRejectAction?.(requestId);
    },
  };
}
