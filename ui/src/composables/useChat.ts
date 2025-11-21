/**
 * useChat Composable
 * 管理 Chat 对话逻辑
 */

import { ref, onMounted } from 'vue';
import type { Message, ChatConfig, TextMessage } from '@/types';
import { useAsterClient } from './useAsterClient';
import { generateId } from '@/utils/format';

export function useChat(config: ChatConfig) {
  const messages = ref<Message[]>([]);
  const isTyping = ref(false);
  const currentInput = ref('');

  const { client, isConnected } = useAsterClient({
    baseUrl: config.apiUrl || 'http://localhost:8080',
    apiKey: config.apiKey,
  });

  // 发送消息
  const sendMessage = async (content: string) => {
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

    // 创建 AI 响应占位
    const assistantMessage: TextMessage = {
      id: generateId('msg'),
      type: 'text',
      role: 'assistant',
      content: { text: '' },
      createdAt: Date.now(),
    };
    messages.value.push(assistantMessage);

    isTyping.value = true;
    userMessage.status = 'sent';

    try {
      // 调用 Aster Client SDK
      // 注意：当前后端只支持同步 chat，不支持流式
      const response = await client.agents.chat(config.agentId || 'default', {
        message: content,
        stream: false,
      });

      // 更新 AI 响应
      assistantMessage.content.text = response.text || response.output || '无响应';
      isTyping.value = false;

    } catch (error: any) {
      console.error('Send message error:', error);
      
      // 错误处理
      assistantMessage.content.text = `❌ 发送失败: ${error.message || '未知错误'}`;
      userMessage.status = 'error';
      isTyping.value = false;

      // 触发错误回调
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
      const welcomeMsg: TextMessage = {
        id: generateId('msg'),
        type: 'text',
        role: 'assistant',
        content: {
          text: typeof config.welcomeMessage === 'string' 
            ? config.welcomeMessage 
            : config.welcomeMessage.content.text
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
    isConnected,
    currentInput,

    // 方法
    sendMessage,
    sendImage,
    retryMessage,
    deleteMessage,
    clearMessages,
  };
}
