<template>
  <div class="aster-list" :class="{ 'aster-list-dividers': dividers }">
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * AsterList Component
 *
 * List container with optional dividers between items.
 */

interface Props {
  componentId?: string;
  surfaceId?: string;
  dividers?: boolean;
}

withDefaults(defineProps<Props>(), {
  dividers: false,
});
</script>

<style scoped>
.aster-list {
  @apply flex flex-col;
}

.aster-list-dividers > :deep(*:not(:last-child)) {
  @apply border-b border-gray-200 dark:border-gray-700;
}
</style>
