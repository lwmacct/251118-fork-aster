<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      </div>
      
      <h2 class="error-title">出错了</h2>
      <p class="error-message">{{ errorMessage }}</p>
      
      <div v-if="showDetails && errorDetails" class="error-details">
        <button
          @click="detailsExpanded = !detailsExpanded"
          class="details-toggle"
        >
          {{ detailsExpanded ? '隐藏' : '查看' }}详细信息
        </button>
        
        <pre v-if="detailsExpanded" class="details-content">{{ errorDetails }}</pre>
      </div>
      
      <div class="error-actions">
        <button @click="handleRetry" class="btn-retry">
          重试
        </button>
        <button @click="handleReset" class="btn-reset">
          重置
        </button>
      </div>
    </div>
  </div>
  
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

interface Props {
  showDetails?: boolean;
}

withDefaults(defineProps<Props>(), {
  showDetails: true,
});

const emit = defineEmits<{
  error: [error: Error];
  retry: [];
  reset: [];
}>();

const hasError = ref(false);
const errorMessage = ref('');
const errorDetails = ref('');
const detailsExpanded = ref(false);

onErrorCaptured((error: Error) => {
  hasError.value = true;
  errorMessage.value = error.message || '发生了未知错误';
  errorDetails.value = error.stack || '';
  
  emit('error', error);
  
  // 阻止错误继续传播
  return false;
});

function handleRetry() {
  hasError.value = false;
  errorMessage.value = '';
  errorDetails.value = '';
  detailsExpanded.value = false;
  emit('retry');
}

function handleReset() {
  hasError.value = false;
  errorMessage.value = '';
  errorDetails.value = '';
  detailsExpanded.value = false;
  emit('reset');
}
</script>

<style scoped>
.error-boundary {
  @apply flex items-center justify-center min-h-screen p-4;
}

.error-content {
  @apply max-w-md w-full bg-surface dark:bg-surface-dark border border-red-200 dark:border-red-800 rounded-lg p-8 text-center;
}

.error-icon {
  @apply flex justify-center mb-4;
}

.error-title {
  @apply text-2xl font-bold text-text dark:text-text-dark mb-2;
}

.error-message {
  @apply text-sm text-secondary dark:text-secondary-dark mb-6;
}

.error-details {
  @apply mb-6;
}

.details-toggle {
  @apply text-sm text-primary hover:text-primary-hover dark:text-primary-light transition-colors mb-2;
}

.details-content {
  @apply text-xs text-left bg-background dark:bg-background-dark p-4 rounded border border-border dark:border-border-dark overflow-x-auto;
}

.error-actions {
  @apply flex gap-2 justify-center;
}

.btn-retry,
.btn-reset {
  @apply px-4 py-2 rounded-lg text-sm font-medium transition-colors;
}

.btn-retry {
  @apply bg-primary hover:bg-primary-hover text-white;
}

.btn-reset {
  @apply bg-background dark:bg-background-dark hover:bg-border dark:hover:bg-border-dark text-text dark:text-text-dark border border-border dark:border-border-dark;
}
</style>
