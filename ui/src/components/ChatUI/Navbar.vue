<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <slot name="brand">
        <span class="brand-text">{{ title }}</span>
      </slot>
    </div>
    
    <div class="navbar-menu">
      <slot name="menu"></slot>
    </div>
    
    <div class="navbar-actions">
      <slot name="actions"></slot>
    </div>
  </nav>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
}

withDefaults(defineProps<Props>(), {
  title: 'Aster Agent',
});
</script>

<style scoped>
.navbar {
  @apply flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700;
}

.navbar-brand {
  @apply flex items-center gap-3;
}

.brand-text {
  @apply text-xl font-bold text-gray-900 dark:text-white;
}

.navbar-menu {
  @apply flex-1 flex items-center justify-center gap-6;
}

.navbar-actions {
  @apply flex items-center gap-3;
}
</style>
