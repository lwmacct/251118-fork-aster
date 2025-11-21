<template>
  <div class="aster-chat flex flex-col h-full bg-background">
    <!-- Header -->
    <div v-if="showHeader" class="aster-chat-header flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
      <div class="flex items-center gap-3">
        <div v-if="agent?.avatar" class="w-10 h-10 rounded-full overflow-hidden">
          <img :src="agent.avatar" :alt="agent.name" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-primary">{{ agent?.name || 'AI Agent' }}</h3>
          <p v-if="agent?.description" class="text-xs text-secondary">{{ agent.description }}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <div v-if="isConnected" class="flex items-center gap-2 text-xs text-secondary">
          <div class="w-2 h-2 rounded-full bg-green-500"></div>
          <span>已连接</span>
        </div>
        <div v-else class="flex items-center gap-2 text-xs text-secondary">
          <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span>未连接</span>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="aster-chat-messages flex-1 overflow-y-auto p-6 space-y-6">
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
        <svg class="w-16 h-16 text-secondary/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
        </svg>
        <p class="text-secondary">{{ config.welcomeMessage || '开始对话...' }}</p>
      </div>

      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :show-thinking="config.enableThinking"
        @approve="handleApprove"
        @reject="handleReject"
      />

      <div v-if="isThinking && messages[messages.length - 1]?.role === 'assistant'" class="flex items-center gap-2 text-sm text-primary animate-pulse">
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>思考中...</span>
      </div>
    </div>

    <!-- Input -->
    <div class="aster-chat-input p-4 border-t border-border bg-surface">
      <div class="flex items-end gap-3">
        <!-- Attachments -->
        <div v-if="config.enableImage || config.enableVoice" class="flex items-center gap-2">
          <button
            v-if="config.enableImage"
            @click="handleImageUpload"
            class="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-primary"
            title="上传图片"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </button>
          
          <button
            v-if="config.enableVoice"
            @click="toggleVoice"
            :class="[
              'p-2 rounded-lg transition-colors',
              isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-background text-secondary hover:text-primary'
            ]"
            title="语音输入"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
            </svg>
          </button>
        </div>

        <!-- Text Input -->
        <div class="flex-1 relative">
          <textarea
            v-model="currentInput"
            @keydown.enter.exact.prevent="handleSend"
            :placeholder="config.placeholder || '输入消息...'"
            :disabled="!isConnected || isThinking"
            class="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-background"
            rows="1"
            style="max-height: 120px;"
          />
        </div>

        <!-- Send Button -->
        <button
          @click="handleSend"
          :disabled="!currentInput.trim() || !isConnected || isThinking"
          class="p-3 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { useChat } from '@/composables/useChat';
import MessageItem from './MessageItem.vue';
import type { ChatConfig, Agent } from '@/types';

interface Props {
  config: ChatConfig;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showHeader: true,
});

const {
  messages,
  agent,
  isThinking,
  isConnected,
  currentInput,
  sendMessage,
  approveAction,
  rejectAction,
} = useChat(props.config);

const messagesContainer = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
const isListening = ref(false);

const handleSend = () => {
  if (currentInput.value.trim()) {
    sendMessage(currentInput.value);
  }
};

const handleApprove = (requestId: string) => {
  approveAction(requestId);
};

const handleReject = (requestId: string) => {
  rejectAction(requestId);
};

const handleImageUpload = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    // Handle file upload
    console.log('File selected:', file);
    // TODO: Implement file upload logic
  }
};

const toggleVoice = () => {
  if (isListening.value) {
    isListening.value = false;
    // Stop recording
  } else {
    isListening.value = true;
    // Start recording
    // TODO: Implement voice input
  }
};

// Auto-scroll to bottom when new messages arrive
watch(messages, async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}, { deep: true });

onMounted(() => {
  // Load welcome message if configured
  if (props.config.welcomeMessage && messages.value.length === 0) {
    // Could add a system message here
  }
});
</script>

<style scoped>
.aster-chat {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.aster-chat-messages::-webkit-scrollbar {
  width: 6px;
}

.aster-chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.aster-chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.aster-chat-messages::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

textarea {
  field-sizing: content;
}
</style>
