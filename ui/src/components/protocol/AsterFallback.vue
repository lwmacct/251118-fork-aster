<template>
  <div class="aster-fallback">
    <span class="aster-fallback-text">Unknown component type</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * AsterFallback Component
 *
 * Rendered when an unknown component type is encountered.
 * Provides a graceful fallback instead of crashing.
 */

interface Props {
  componentId?: string;
  surfaceId?: string;
}

defineProps<Props>();
</script>

<style scoped>
.aster-fallback {
  @apply p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 text-sm;
}

.aster-fallback-text {
  @apply block mb-1;
}
</style>
