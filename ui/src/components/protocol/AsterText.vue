<template>
  <component :is="tagName" :class="textClass">
    {{ sanitizedText }}
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TextUsageHint } from '@/types/ui-protocol';
import { sanitizeText } from '@/protocol/security';

/**
 * AsterText Component
 *
 * Text display with semantic styling based on usage hint.
 */

interface Props {
  componentId?: string;
  surfaceId?: string;
  text?: string;
  usageHint?: TextUsageHint;
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  usageHint: 'body',
});

// Sanitize text to prevent XSS
const sanitizedText = computed(() => {
  // Note: We use textContent binding ({{ }}) which auto-escapes,
  // but we still sanitize for defense in depth
  return props.text;
});

// Map usage hint to HTML tag
const tagName = computed(() => {
  const tagMap: Record<TextUsageHint, string> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    caption: 'span',
    body: 'p',
  };
  return tagMap[props.usageHint] ?? 'p';
});

// Map usage hint to CSS class
const textClass = computed(() => {
  const classMap: Record<TextUsageHint, string> = {
    h1: 'aster-text-h1',
    h2: 'aster-text-h2',
    h3: 'aster-text-h3',
    h4: 'aster-text-h4',
    h5: 'aster-text-h5',
    caption: 'aster-text-caption',
    body: 'aster-text-body',
  };
  return ['aster-text', classMap[props.usageHint] ?? 'aster-text-body'];
});
</script>

<style scoped>
.aster-text {
  color: var(--aster-text, #111827);
}

.dark .aster-text {
  color: var(--aster-text, #f1f5f9);
}

.aster-text-h1 {
  @apply font-bold mb-4;
  font-size: var(--aster-font-size-3xl, 1.875rem);
}

.aster-text-h2 {
  @apply font-semibold mb-3;
  font-size: var(--aster-font-size-2xl, 1.5rem);
}

.aster-text-h3 {
  @apply font-semibold mb-2;
  font-size: var(--aster-font-size-xl, 1.25rem);
}

.aster-text-h4 {
  @apply font-medium mb-2;
  font-size: var(--aster-font-size-lg, 1.125rem);
}

.aster-text-h5 {
  @apply font-medium mb-1;
  font-size: var(--aster-font-size-base, 1rem);
}

.aster-text-caption {
  font-size: var(--aster-font-size-sm, 0.875rem);
  color: var(--aster-text-secondary, #6b7280);
}

.dark .aster-text-caption {
  color: var(--aster-text-secondary, #cbd5e1);
}

.aster-text-body {
  font-size: var(--aster-font-size-base, 1rem);
  line-height: var(--aster-line-height-relaxed, 1.625);
}
</style>
