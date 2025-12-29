<template>
  <img
    v-if="isValidSrc"
    :src="sanitizedSrc"
    :alt="alt"
    :class="imageClass"
    loading="lazy"
  />
  <div v-else class="aster-image-placeholder" :class="sizeClass">
    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ImageUsageHint } from '@/types/ui-protocol';
import { validateUrl, sanitizeUrl } from '@/protocol/security';

/**
 * AsterImage Component
 *
 * Image display with size hints and URL validation.
 */

interface Props {
  componentId?: string;
  surfaceId?: string;
  src?: string;
  alt?: string;
  usageHint?: ImageUsageHint;
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  alt: '',
  usageHint: 'mediumFeature',
});

// Validate and sanitize URL
const isValidSrc = computed(() => validateUrl(props.src));
const sanitizedSrc = computed(() => sanitizeUrl(props.src));

// Map usage hint to size class
const sizeClass = computed(() => {
  const sizeMap: Record<ImageUsageHint, string> = {
    icon: 'aster-image-icon',
    avatar: 'aster-image-avatar',
    smallFeature: 'aster-image-small',
    mediumFeature: 'aster-image-medium',
    largeFeature: 'aster-image-large',
    header: 'aster-image-header',
  };
  return sizeMap[props.usageHint] ?? 'aster-image-medium';
});

const imageClass = computed(() => ['aster-image', sizeClass.value]);
</script>

<style scoped>
.aster-image {
  @apply object-cover rounded;
}

.aster-image-icon {
  @apply w-6 h-6;
}

.aster-image-avatar {
  @apply w-10 h-10 rounded-full;
}

.aster-image-small {
  @apply w-24 h-24;
}

.aster-image-medium {
  @apply w-48 h-48;
}

.aster-image-large {
  @apply w-full max-w-md h-auto;
}

.aster-image-header {
  @apply w-full h-48 object-cover rounded-none;
}

.aster-image-placeholder {
  @apply flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded;
}
</style>
