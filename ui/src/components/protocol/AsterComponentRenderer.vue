<template>
  <component
    :is="componentType"
    v-bind="componentProps"
    @action="handleAction"
    @update:value="handleValueUpdate"
  >
    <template v-if="node.children && node.children.length > 0">
      <AsterComponentRenderer
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :surface-id="surfaceId"
        @action="handleAction"
        @update:value="handleValueUpdate"
      />
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { AnyComponentNode, UIActionEvent, DataValue } from '@/types/ui-protocol';

/**
 * AsterComponentRenderer
 *
 * Recursively renders component nodes from the component tree.
 * Maps component types to their Vue implementations.
 */

interface Props {
  /** Component node to render */
  node: AnyComponentNode;
  /** Surface ID for event context */
  surfaceId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  action: [event: UIActionEvent];
  'update:value': [path: string, value: DataValue];
}>();

// Component type mapping
const componentMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  // Layout components
  Row: defineAsyncComponent(() => import('./AsterRow.vue')),
  Column: defineAsyncComponent(() => import('./AsterColumn.vue')),
  Card: defineAsyncComponent(() => import('./AsterCard.vue')),
  List: defineAsyncComponent(() => import('./AsterList.vue')),
  Tabs: defineAsyncComponent(() => import('./AsterTabs.vue')),
  Modal: defineAsyncComponent(() => import('./AsterModal.vue')),
  Divider: defineAsyncComponent(() => import('./AsterDivider.vue')),

  // Content components
  Text: defineAsyncComponent(() => import('./AsterText.vue')),
  Image: defineAsyncComponent(() => import('./AsterImage.vue')),
  Icon: defineAsyncComponent(() => import('./AsterIcon.vue')),
  Video: defineAsyncComponent(() => import('./AsterVideo.vue')),
  AudioPlayer: defineAsyncComponent(() => import('./AsterAudioPlayer.vue')),

  // Input components
  Button: defineAsyncComponent(() => import('./AsterButton.vue')),
  TextField: defineAsyncComponent(() => import('./AsterTextField.vue')),
  Checkbox: defineAsyncComponent(() => import('./AsterCheckbox.vue')),
  Select: defineAsyncComponent(() => import('./AsterSelect.vue')),
  DateTimeInput: defineAsyncComponent(() => import('./AsterDateTimeInput.vue')),
  Slider: defineAsyncComponent(() => import('./AsterSlider.vue')),
  MultipleChoice: defineAsyncComponent(() => import('./AsterMultipleChoice.vue')),
};

// Fallback component for unknown types
const FallbackComponent = defineAsyncComponent(() => import('./AsterFallback.vue'));

// Get the component to render
const componentType = computed(() => {
  return componentMap[props.node.type] ?? FallbackComponent;
});

// Get component props (excluding children which are handled separately)
const componentProps = computed(() => {
  const { children, ...rest } = props.node.props;
  return {
    ...rest,
    componentId: props.node.id,
    surfaceId: props.surfaceId,
  };
});

/**
 * Handle action events and add component context
 */
function handleAction(event: UIActionEvent) {
  emit('action', event);
}

/**
 * Handle value updates from input components
 */
function handleValueUpdate(path: string, value: DataValue) {
  emit('update:value', path, value);
}
</script>
