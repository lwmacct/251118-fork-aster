/**
 * Aster UI Protocol - Streaming Rendering State Preservation Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 9: Streaming Rendering State Preservation
 *
 * Validates: Requirements 6.4, 6.5
 *
 * For any sequence of incremental updates, the renderer should preserve
 * component state (such as scroll position, input focus) during updates,
 * rather than resetting state.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageProcessor,
  createMessageProcessor,
} from '@/protocol/message-processor';
import { createStandardRegistry } from '@/protocol/standard-components';
import type { ComponentDefinition } from '@/types/ui-protocol';
import {
  getPreservedState,
  clearPreservedState,
  type PreservedState,
} from '@/composables/useStreamingState';

// ==================
// Arbitrary Generators
// ==================

/**
 * Generate valid surface ID
 */
const surfaceIdArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * Generate valid component ID
 */
const componentIdArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * Generate scroll position
 */
const scrollPositionArb = fc.record({
  top: fc.integer({ min: 0, max: 10000 }),
  left: fc.integer({ min: 0, max: 10000 }),
});

/**
 * Generate Text component definition
 */
function createTextComponent(id: string, text: string): ComponentDefinition {
  return {
    id,
    component: { Text: { text: { literalString: text } } },
  };
}

/**
 * Generate Column component with children
 */
function createColumnComponent(id: string, childIds: string[]): ComponentDefinition {
  return {
    id,
    component: {
      Column: {
        children: { explicitList: childIds },
        gap: 8,
      },
    },
  };
}

// ==================
// Property Tests
// ==================

describe('Streaming Rendering State Preservation', () => {
  let processor: MessageProcessor;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
  });

  describe('Property 9: Streaming Rendering State Preservation', () => {
    /**
     * Feature: aster-ui-protocol, Property 9: Streaming Rendering State Preservation
     * Validates: Requirements 6.4, 6.5
     *
     * For any sequence of incremental updates, the renderer should preserve
     * component state (such as scroll position, input focus) during updates,
     * rather than resetting state.
     */

    describe('Streaming mode detection (Requirement 6.4)', () => {
      it('should enter streaming mode when beginRendering is called before root component is defined', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            (surfaceId, rootId) => {
              processor.clearSurfaces();

              // Call beginRendering before defining root component
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Should be in streaming mode
              expect(processor.isStreaming(surfaceId)).toBe(true);

              // Surface should exist but have no component tree
              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();
              expect(surface!.rootComponentId).toBe(rootId);
              expect(surface!.componentTree).toBeNull();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should render available components when root is defined after beginRendering', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, rootId, text) => {
              processor.clearSurfaces();

              // Call beginRendering first
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Now define the root component
              const rootComp = createTextComponent(rootId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp] },
              });

              // Should have component tree now
              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();
              expect(surface!.componentTree).not.toBeNull();
              expect(surface!.componentTree!.id).toBe(rootId);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should track pending components in streaming mode', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            componentIdArb,
            (surfaceId, rootId, child1Id, child2Id) => {
              // Ensure unique IDs
              const safeChild1Id = child1Id === rootId ? `${child1Id}_1` : child1Id;
              const safeChild2Id = child2Id === rootId || child2Id === safeChild1Id
                ? `${child2Id}_2`
                : child2Id;

              processor.clearSurfaces();

              // Define root with children references
              const rootComp = createColumnComponent(rootId, [safeChild1Id, safeChild2Id]);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp] },
              });

              // Begin rendering
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Should be in streaming mode (children not defined)
              expect(processor.isStreaming(surfaceId)).toBe(true);

              // Get streaming state
              const streamingState = processor.getStreamingState(surfaceId);
              expect(streamingState).toBeDefined();
              expect(streamingState!.pendingComponentIds.has(safeChild1Id)).toBe(true);
              expect(streamingState!.pendingComponentIds.has(safeChild2Id)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should resolve pending components as they arrive', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, rootId, childId, text) => {
              // Ensure unique IDs
              const safeChildId = childId === rootId ? `${childId}_child` : childId;

              processor.clearSurfaces();

              // Define root with child reference
              const rootComp = createColumnComponent(rootId, [safeChildId]);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp] },
              });

              // Begin rendering
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Child should be pending
              let streamingState = processor.getStreamingState(surfaceId);
              expect(streamingState!.pendingComponentIds.has(safeChildId)).toBe(true);

              // Now define the child
              const childComp = createTextComponent(safeChildId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [childComp] },
              });

              // Child should no longer be pending
              streamingState = processor.getStreamingState(surfaceId);
              expect(streamingState!.pendingComponentIds.has(safeChildId)).toBe(false);

              // Component tree should include the child
              const surface = processor.getSurface(surfaceId);
              expect(surface!.componentTree!.children).toBeDefined();
              expect(surface!.componentTree!.children!.length).toBe(1);
              expect(surface!.componentTree!.children![0]!.id).toBe(safeChildId);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('State preservation mechanism (Requirement 6.5)', () => {
      it('should preserve scroll positions across updates', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            scrollPositionArb,
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
            (surfaceId, scrollPos, elementId) => {
              // Clear any existing state
              clearPreservedState(surfaceId);

              // Get preserved state
              const state = getPreservedState(surfaceId);

              // Save scroll position
              state.scrollPositions.set(elementId, scrollPos);

              // Verify scroll position is preserved
              const savedPos = state.scrollPositions.get(elementId);
              expect(savedPos).toEqual(scrollPos);

              // Simulate update (state should persist)
              const stateAfterUpdate = getPreservedState(surfaceId);
              expect(stateAfterUpdate.scrollPositions.get(elementId)).toEqual(scrollPos);

              // Cleanup
              clearPreservedState(surfaceId);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should preserve focus state across updates', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
            (surfaceId, focusedId) => {
              // Clear any existing state
              clearPreservedState(surfaceId);

              // Get preserved state
              const state = getPreservedState(surfaceId);

              // Save focus state
              state.focusedElementId = focusedId;

              // Verify focus state is preserved
              expect(state.focusedElementId).toBe(focusedId);

              // Simulate update (state should persist)
              const stateAfterUpdate = getPreservedState(surfaceId);
              expect(stateAfterUpdate.focusedElementId).toBe(focusedId);

              // Cleanup
              clearPreservedState(surfaceId);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should preserve pending input values across updates', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
            fc.string(),
            (surfaceId, inputId, inputValue) => {
              // Clear any existing state
              clearPreservedState(surfaceId);

              // Get preserved state
              const state = getPreservedState(surfaceId);

              // Save pending input value
              state.pendingInputValues.set(inputId, inputValue);

              // Verify input value is preserved
              expect(state.pendingInputValues.get(inputId)).toBe(inputValue);

              // Simulate update (state should persist)
              const stateAfterUpdate = getPreservedState(surfaceId);
              expect(stateAfterUpdate.pendingInputValues.get(inputId)).toBe(inputValue);

              // Cleanup
              clearPreservedState(surfaceId);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should clear state when surface is deleted', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            scrollPositionArb,
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
            (surfaceId, scrollPos, elementId) => {
              // Setup state
              const state = getPreservedState(surfaceId);
              state.scrollPositions.set(elementId, scrollPos);
              state.focusedElementId = elementId;

              // Clear state
              clearPreservedState(surfaceId);

              // Get fresh state (should be empty)
              const freshState = getPreservedState(surfaceId);
              expect(freshState.scrollPositions.size).toBe(0);
              expect(freshState.focusedElementId).toBeNull();
              expect(freshState.pendingInputValues.size).toBe(0);

              // Cleanup
              clearPreservedState(surfaceId);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Incremental component addition (Requirement 6.4)', () => {
      it('should support adding components incrementally without full re-render', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            fc.array(componentIdArb, { minLength: 2, maxLength: 5 }),
            fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
            (surfaceId, componentIds, texts) => {
              // Ensure unique IDs
              const uniqueIds = [...new Set(componentIds)];
              if (uniqueIds.length < 2) return;

              processor.clearSurfaces();

              // Create root with all children references
              const rootId = `root_${surfaceId}`;
              const childIds = uniqueIds.slice(0, Math.min(uniqueIds.length, texts.length));
              const rootComp = createColumnComponent(rootId, childIds);

              // Add root and begin rendering
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Add children one by one
              for (let i = 0; i < childIds.length; i++) {
                const childComp = createTextComponent(childIds[i]!, texts[i] ?? `text_${i}`);
                processor.processMessage({
                  surfaceUpdate: { surfaceId, components: [childComp] },
                });

                // Verify component was added
                const surface = processor.getSurface(surfaceId);
                expect(surface!.components.has(childIds[i]!)).toBe(true);
              }

              // Final tree should have all children
              const surface = processor.getSurface(surfaceId);
              expect(surface!.componentTree).not.toBeNull();
              expect(surface!.componentTree!.children?.length).toBe(childIds.length);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should track rendered components in streaming state', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, rootId, text) => {
              processor.clearSurfaces();

              // Add and render a component
              const rootComp = createTextComponent(rootId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Check streaming state tracks rendered component
              const streamingState = processor.getStreamingState(surfaceId);
              expect(streamingState).toBeDefined();
              expect(streamingState!.renderedComponentIds.has(rootId)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});
