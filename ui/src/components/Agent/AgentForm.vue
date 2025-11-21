<template>
  <form @submit.prevent="handleSubmit" class="agent-form">
    <!-- Basic Info -->
    <div class="form-section">
      <h3 class="section-title">基本信息</h3>
      
      <div class="form-field">
        <label class="field-label">名称 *</label>
        <input
          v-model="formData.name"
          type="text"
          placeholder="输入 Agent 名称"
          class="field-input"
          required
        />
      </div>
      
      <div class="form-field">
        <label class="field-label">描述</label>
        <textarea
          v-model="formData.description"
          placeholder="输入 Agent 描述"
          class="field-textarea"
          rows="3"
        ></textarea>
      </div>
      
      <div class="form-field">
        <label class="field-label">头像 URL</label>
        <input
          v-model="formData.avatar"
          type="url"
          placeholder="https://example.com/avatar.jpg"
          class="field-input"
        />
      </div>
    </div>
    
    <!-- Model Config -->
    <div class="form-section">
      <h3 class="section-title">模型配置</h3>
      
      <div class="form-field">
        <label class="field-label">提供商 *</label>
        <select v-model="formData.provider" class="field-select" required>
          <option value="">选择提供商</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="google">Google</option>
        </select>
      </div>
      
      <div class="form-field">
        <label class="field-label">模型 *</label>
        <select v-model="formData.model" class="field-select" required>
          <option value="">选择模型</option>
          <optgroup v-if="formData.provider === 'anthropic'" label="Anthropic">
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-opus-4">Claude Opus 4</option>
          </optgroup>
          <optgroup v-if="formData.provider === 'openai'" label="OpenAI">
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-4">GPT-4</option>
          </optgroup>
          <optgroup v-if="formData.provider === 'google'" label="Google">
            <option value="gemini-pro">Gemini Pro</option>
            <option value="gemini-ultra">Gemini Ultra</option>
          </optgroup>
        </select>
      </div>
      
      <div class="form-field">
        <label class="field-label">Temperature</label>
        <div class="range-field">
          <input
            v-model.number="formData.temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="field-range"
          />
          <span class="range-value">{{ formData.temperature }}</span>
        </div>
      </div>
      
      <div class="form-field">
        <label class="field-label">Max Tokens</label>
        <input
          v-model.number="formData.maxTokens"
          type="number"
          min="1"
          max="100000"
          placeholder="4096"
          class="field-input"
        />
      </div>
    </div>
    
    <!-- System Prompt -->
    <div class="form-section">
      <h3 class="section-title">系统提示词</h3>
      
      <div class="form-field">
        <textarea
          v-model="formData.systemPrompt"
          placeholder="输入系统提示词..."
          class="field-textarea"
          rows="5"
        ></textarea>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="form-actions">
      <button
        type="button"
        @click="$emit('cancel')"
        class="btn-cancel"
      >
        取消
      </button>
      <button
        type="submit"
        :disabled="!isValid || submitting"
        class="btn-submit"
      >
        <LoadingSpinner v-if="submitting" size="sm" color="white" />
        <span v-else>{{ isEdit ? '保存' : '创建' }}</span>
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import LoadingSpinner from '../Common/LoadingSpinner.vue';
import type { Agent } from '@/types';

interface Props {
  agent?: Agent;
  submitting?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [data: any];
  cancel: [];
}>();

const isEdit = computed(() => !!props.agent);

const formData = ref({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  avatar: props.agent?.avatar || '',
  provider: props.agent?.metadata?.provider || '',
  model: props.agent?.metadata?.model || '',
  temperature: props.agent?.metadata?.temperature || 0.7,
  maxTokens: props.agent?.metadata?.maxTokens || 4096,
  systemPrompt: props.agent?.metadata?.systemPrompt || '',
});

const isValid = computed(() => {
  return formData.value.name.trim() !== '' &&
         formData.value.provider !== '' &&
         formData.value.model !== '';
});

function handleSubmit() {
  if (!isValid.value) return;
  
  const data = {
    name: formData.value.name,
    description: formData.value.description,
    avatar: formData.value.avatar,
    metadata: {
      provider: formData.value.provider,
      model: formData.value.model,
      temperature: formData.value.temperature,
      maxTokens: formData.value.maxTokens,
      systemPrompt: formData.value.systemPrompt,
    },
  };
  
  emit('submit', data);
}

// 监听 agent 变化
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    formData.value = {
      name: newAgent.name || '',
      description: newAgent.description || '',
      avatar: newAgent.avatar || '',
      provider: newAgent.metadata?.provider || '',
      model: newAgent.metadata?.model || '',
      temperature: newAgent.metadata?.temperature || 0.7,
      maxTokens: newAgent.metadata?.maxTokens || 4096,
      systemPrompt: newAgent.metadata?.systemPrompt || '',
    };
  }
}, { immediate: true });
</script>

<style scoped>
.agent-form {
  @apply space-y-6;
}

.form-section {
  @apply space-y-4;
}

.section-title {
  @apply text-lg font-semibold text-text dark:text-text-dark pb-2 border-b border-border dark:border-border-dark;
}

.form-field {
  @apply space-y-2;
}

.field-label {
  @apply block text-sm font-medium text-text dark:text-text-dark;
}

.field-input,
.field-select,
.field-textarea {
  @apply w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors;
}

.field-textarea {
  @apply resize-none;
}

.range-field {
  @apply flex items-center gap-3;
}

.field-range {
  @apply flex-1;
}

.range-value {
  @apply text-sm font-medium text-text dark:text-text-dark min-w-[3rem] text-right;
}

.form-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-border dark:border-border-dark;
}

.btn-cancel,
.btn-submit {
  @apply px-4 py-2 rounded-lg text-sm font-medium transition-colors;
}

.btn-cancel {
  @apply bg-background dark:bg-background-dark hover:bg-border dark:hover:bg-border-dark text-text dark:text-text-dark border border-border dark:border-border-dark;
}

.btn-submit {
  @apply bg-primary hover:bg-primary-hover text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2;
}
</style>
