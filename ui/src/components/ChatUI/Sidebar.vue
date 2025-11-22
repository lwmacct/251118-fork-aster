<template>
  <div :class="['sidebar', positionClass, { collapsed }]">
    <div class="sidebar-header">
      <slot name="header">
        <h3 class="sidebar-title">{{ title }}</h3>
      </slot>
      <button v-if="collapsible" class="collapse-btn" @click="toggle">
        <Icon :type="collapsed ? 'chevron-right' : 'chevron-left'" />
      </button>
    </div>
    
    <div class="sidebar-content">
      <slot></slot>
    </div>
    
    <div v-if="$slots.footer" class="sidebar-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Icon from './Icon.vue';

interface Props {
  title?: string;
  position?: 'left' | 'right';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  position: 'left',
  collapsible: false,
  defaultCollapsed: false,
});

const collapsed = ref(props.defaultCollapsed);

const positionClass = computed(() => {
  return props.position === 'right' ? 'sidebar-right' : 'sidebar-left';
});

const toggle = () => {
  collapsed.value = !collapsed.value;
};
</script>

<style scoped>
.sidebar {
  @apply flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 transition-all duration-300;
}

.sidebar-left {
  @apply border-r;
}

.sidebar-right {
  @apply border-l;
}

.sidebar:not(.collapsed) {
  @apply w-80;
}

.sidebar.collapsed {
  @apply w-16;
}

.sidebar-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700;
}

.sidebar-title {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
}

.sidebar.collapsed .sidebar-title {
  @apply hidden;
}

.collapse-btn {
  @apply p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors;
}

.sidebar-content {
  @apply flex-1 overflow-y-auto p-4;
  max-height: calc(100vh - 120px);
  overflow-y: scroll;
  -webkit-overflow-scrolling: touch;
}

.sidebar.collapsed .sidebar-content {
  @apply p-2;
}

.sidebar-footer {
  @apply px-4 py-3 border-t border-gray-200 dark:border-gray-700;
}
</style>
