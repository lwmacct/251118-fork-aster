<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click="handleOverlayClick">
        <div
          :class="['modal-container', sizeClass]"
          @click.stop
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <h3 class="modal-title">{{ title }}</h3>
            </slot>
            <button
              v-if="closable"
              @click="handleClose"
              class="modal-close"
              aria-label="关闭"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <!-- Body -->
          <div class="modal-body">
            <slot></slot>
          </div>
          
          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';

interface Props {
  modelValue: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  closeOnOverlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
  closeOnOverlay: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const sizeClass = computed(() => {
  const sizes = {
    sm: 'modal-sm',
    md: 'modal-md',
    lg: 'modal-lg',
    xl: 'modal-xl',
  };
  return sizes[props.size];
});

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    handleClose();
  }
}

// 防止背景滚动
watch(() => props.modelValue, (value) => {
  if (value) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50;
}

.modal-container {
  @apply bg-surface dark:bg-surface-dark rounded-lg shadow-xl max-h-[90vh] flex flex-col;
}

.modal-sm {
  @apply max-w-sm w-full;
}

.modal-md {
  @apply max-w-md w-full;
}

.modal-lg {
  @apply max-w-2xl w-full;
}

.modal-xl {
  @apply max-w-4xl w-full;
}

.modal-header {
  @apply flex items-center justify-between px-6 py-4 border-b border-border dark:border-border-dark;
}

.modal-title {
  @apply text-lg font-semibold text-text dark:text-text-dark;
}

.modal-close {
  @apply p-1 hover:bg-background dark:hover:bg-background-dark rounded transition-colors text-secondary dark:text-secondary-dark hover:text-text dark:hover:text-text-dark;
}

.modal-body {
  @apply px-6 py-4 overflow-y-auto flex-1;
}

.modal-footer {
  @apply px-6 py-4 border-t border-border dark:border-border-dark flex justify-end gap-2;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  @apply transition-opacity duration-200;
}

.modal-enter-from,
.modal-leave-to {
  @apply opacity-0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  @apply transition-transform duration-200;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  @apply scale-95;
}
</style>
