<template>
  <div :class="['editor-panel', { 'editor-panel-fullscreen': isFullscreen }]">
    <!-- 头部 -->
    <div class="editor-header">
      <div class="header-tabs">
        <button
          :class="['tab-button', { active: mode === 'edit' }]"
          @click="setMode('edit')"
        >
          <Icon type="edit" size="sm" />
          编辑
        </button>
        <button
          :class="['tab-button', { active: mode === 'preview' }]"
          @click="setMode('preview')"
        >
          <Icon type="eye" size="sm" />
          预览
        </button>
      </div>

      <div class="header-actions">
        <button class="action-button" title="导出" @click="handleExport">
          <Icon type="download" size="sm" />
        </button>
        <button class="action-button" title="全屏" @click="toggleFullscreen">
          <Icon :type="isFullscreen ? 'minimize' : 'maximize'" size="sm" />
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="editor-content">
      <!-- 编辑模式 -->
      <textarea
        v-if="mode === 'edit'"
        v-model="localContent"
        class="editor-textarea"
        placeholder="在这里编辑内容..."
        @input="handleInput"
      />

      <!-- 预览模式 -->
      <div v-else class="editor-preview">
        <RichText :content="localContent || '暂无内容'" />
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="editor-footer">
      <div class="footer-stats">
        <span class="stat-item">
          <Icon type="text" size="sm" />
          {{ wordCount }} 字
        </span>
        <span class="stat-item">
          <Icon type="list" size="sm" />
          {{ lineCount }} 行
        </span>
      </div>
      
      <div class="footer-actions">
        <button class="footer-button" @click="handleClear">
          清空
        </button>
        <button class="footer-button footer-button-primary" @click="handleSave">
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Icon from '../ChatUI/Icon.vue';
import RichText from '../ChatUI/RichText.vue';

interface Props {
  modelValue: string;
  mode?: 'edit' | 'preview';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'edit',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:mode': [mode: 'edit' | 'preview'];
  save: [content: string];
  export: [content: string];
}>();

const localContent = ref(props.modelValue);
const isFullscreen = ref(false);

watch(() => props.modelValue, (val) => {
  localContent.value = val;
});

const wordCount = computed(() => {
  return localContent.value.replace(/\s/g, '').length;
});

const lineCount = computed(() => {
  return localContent.value.split('\n').length;
});

const handleInput = () => {
  emit('update:modelValue', localContent.value);
};

const setMode = (newMode: 'edit' | 'preview') => {
  emit('update:mode', newMode);
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

const handleSave = () => {
  emit('save', localContent.value);
};

const handleExport = () => {
  emit('export', localContent.value);
  
  // 下载为 Markdown 文件
  const blob = new Blob([localContent.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `document-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleClear = () => {
  if (confirm('确定要清空内容吗？')) {
    localContent.value = '';
    emit('update:modelValue', '');
  }
};
</script>

<style scoped>
.editor-panel {
  @apply flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 w-[500px] flex-shrink-0;
}

.editor-panel-fullscreen {
  @apply fixed inset-0 z-50 w-full;
}

.editor-header {
  @apply flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900;
}

.header-tabs {
  @apply flex gap-1;
}

.tab-button {
  @apply flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded transition-colors;
}

.tab-button.active {
  @apply bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm;
}

.header-actions {
  @apply flex gap-1;
}

.action-button {
  @apply p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors;
}

.editor-content {
  @apply flex-1 overflow-hidden;
}

.editor-textarea {
  @apply w-full h-full p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm leading-relaxed resize-none focus:outline-none;
}

.editor-preview {
  @apply h-full overflow-y-auto p-6 prose dark:prose-invert max-w-none;
}

.editor-footer {
  @apply flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900;
}

.footer-stats {
  @apply flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400;
}

.stat-item {
  @apply flex items-center gap-1;
}

.footer-actions {
  @apply flex gap-2;
}

.footer-button {
  @apply px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors;
}

.footer-button-primary {
  @apply bg-blue-500 hover:bg-blue-600 text-white;
}
</style>
