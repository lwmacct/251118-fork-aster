<template>
  <label class="aster-checkbox" :class="{ 'aster-checkbox-disabled': disabledValue }">
    <input
      type="checkbox"
      class="aster-checkbox-input"
      :checked="checkedValue"
      :disabled="disabledValue"
      @change="handleChange"
    />
    <span class="aster-checkbox-box">
      <svg v-if="checkedValue" class="aster-checkbox-check" viewBox="0 0 12 12">
        <path d="M3.5 6L5.5 8L8.5 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span v-if="labelValue" class="aster-checkbox-label">{{ labelValue }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DataValue, PropertyValue } from '@/types/ui-protocol';
import { useAsterDataBinding } from '@/composables/useAsterDataBinding';

/**
 * AsterCheckbox Component
 *
 * Checkbox with label and two-way binding support.
 * Uses useAsterDataBinding for reactive data binding with the data model.
 */

interface Props {
  componentId?: string;
  surfaceId?: string;
  /** Checked property - can be literal or path reference */
  checked?: PropertyValue | boolean;
  /** Label property - can be literal or path reference */
  label?: PropertyValue | string;
  /** Disabled property - can be literal or path reference */
  disabled?: PropertyValue | boolean;
  /** Path for two-way binding (legacy support) */
  checkedPath?: string;
}

const props = withDefaults(defineProps<Props>(), {});

const emit = defineEmits<{
  'update:value': [path: string, value: DataValue];
}>();

// Convert props to PropertyValue format for binding
function toPropertyValue(value: PropertyValue | string | boolean | undefined): PropertyValue | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return { literalString: value };
  if (typeof value === 'boolean') return { literalBoolean: value };
  return value as PropertyValue;
}

// Use data binding for checked
const { value: boundChecked, updateValue, path: checkedPath } = useAsterDataBinding({
  propertyValue: toPropertyValue(props.checked),
  defaultValue: false,
});

// Use data binding for label
const { value: boundLabel } = useAsterDataBinding({
  propertyValue: toPropertyValue(props.label),
  defaultValue: '',
});

// Use data binding for disabled
const { value: boundDisabled } = useAsterDataBinding({
  propertyValue: toPropertyValue(props.disabled),
  defaultValue: false,
});

// Computed values for template
const checkedValue = computed(() => Boolean(boundChecked.value));
const labelValue = computed(() => boundLabel.value ? String(boundLabel.value) : undefined);
const disabledValue = computed(() => Boolean(boundDisabled.value));

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const newValue = target.checked;

  // Update via data binding
  updateValue(newValue);

  // Also emit for legacy support
  const path = checkedPath ?? props.checkedPath;
  if (path) {
    emit('update:value', path, newValue);
  }
}
</script>

<style scoped>
.aster-checkbox {
  @apply inline-flex items-center cursor-pointer;
  gap: var(--aster-spacing-sm, 0.5rem);
}

.aster-checkbox-disabled {
  @apply opacity-50 cursor-not-allowed;
}

.aster-checkbox-input {
  @apply sr-only;
}

.aster-checkbox-box {
  @apply w-5 h-5 flex items-center justify-center transition-colors;
  border: 2px solid var(--aster-border, #e5e7eb);
  border-radius: var(--aster-radius-sm, 0.25rem);
  background-color: var(--aster-surface, #ffffff);
}

.dark .aster-checkbox-box {
  border-color: var(--aster-border, #475569);
  background-color: var(--aster-surface, #334155);
}

.aster-checkbox-input:checked + .aster-checkbox-box {
  background-color: var(--aster-primary, #3b82f6);
  border-color: var(--aster-primary, #3b82f6);
}

.aster-checkbox-input:focus + .aster-checkbox-box {
  @apply ring-2 ring-offset-2;
  --tw-ring-color: var(--aster-border-focus, #3b82f6);
}

.aster-checkbox-check {
  @apply w-3 h-3;
  color: var(--aster-primary-contrast, #ffffff);
}

.aster-checkbox-label {
  font-size: var(--aster-font-size-sm, 0.875rem);
  color: var(--aster-text-secondary, #6b7280);
}

.dark .aster-checkbox-label {
  color: var(--aster-text-secondary, #cbd5e1);
}
</style>
