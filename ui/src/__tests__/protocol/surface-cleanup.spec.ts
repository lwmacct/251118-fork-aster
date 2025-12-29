/**
 * Aster UI Protocol - Surface Cleanup Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 16: Surface Cleanup
 *
 * Validates: Requirements 10.4
 *
 * For any deleted Surface, the renderer should correctly unload all related
 * Vue components and clean up resources, with no memory leaks.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
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

/**
 * Generate scroll position
 */
const scrollPositionArb = fc.record({
  top: fc.integer({ min: 0, max: 10000 }),
  left: fc.integer({ min: 0, max: 10000 }),
});

// ==================
// Property Tests
// ==================

describe('Surface Cleanup', () => {
  let processor: MessageProcessor;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
  });

  describe('Property 16: Surface Cleanup', () => {
    /**
     * Feature: aster-ui-protocol, Property 16: Surface Cleanup
     * Validates: Requirements 10.4
     *
     * For any deleted Surface, the renderer should correctly unload all related
     * Vue components and clean up resources, with no memory leaks.
     */

    describe('Surface deletion removes all state (Requirement 10.4)', () => {
      it('should remove surface from processor when deleteSurface is called', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, componentId, text) => {
              processor.clearSurfaces();

              // Create surface with component
              const component = createTextComponent(componentId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: componentId },
              });

              // Verify surface exists
              expect(processor.hasSurface(surfaceId)).toBe(true);
              expect(processor.getSurface(surfaceId)).toBeDefined();

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Verify surface is removed
              expect(processor.hasSurface(surfaceId)).toBe(false);
              expect(processor.getSurface(surfaceId)).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should remove streaming state when surface is deleted', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            (surfaceId, rootId, childId) => {
              // Ensure unique IDs
              const safeChildId = childId === rootId ? `${childId}_child` : childId;

              processor.clearSurfaces();

              // Create surface with streaming state
              const rootComp = createColumnComponent(rootId, [safeChildId]);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Verify streaming state exists
              expect(processor.getStreamingState(surfaceId)).toBeDefined();

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Verify streaming state is removed
              expect(processor.getStreamingState(surfaceId)).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should notify delete listeners before cleanup', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, componentId, text) => {
              processor.clearSurfaces();

              // Create surface
              const component = createTextComponent(componentId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // Track deletion notification
              let deleteNotified = false;
              let notifiedSurfaceId: string | null = null;

              // Subscribe to delete events
              processor.subscribeToDelete(surfaceId, (id) => {
                deleteNotified = true;
                notifiedSurfaceId = id;
              });

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Verify listener was notified
              expect(deleteNotified).toBe(true);
              expect(notifiedSurfaceId).toBe(surfaceId);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should allow unsubscribing from delete events', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, componentId, text) => {
              processor.clearSurfaces();

              // Create surface
              const component = createTextComponent(componentId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // Track deletion notification
              let deleteNotified = false;

              // Subscribe and immediately unsubscribe
              const unsubscribe = processor.subscribeToDelete(surfaceId, () => {
                deleteNotified = true;
              });
              unsubscribe();

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Verify listener was NOT notified (unsubscribed)
              expect(deleteNotified).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should remove change listeners when surface is deleted', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, componentId, text) => {
              processor.clearSurfaces();

              // Create surface
              const component = createTextComponent(componentId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // Subscribe to changes
              let changeCount = 0;
              processor.subscribe(surfaceId, () => {
                changeCount++;
              });

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Reset count
              changeCount = 0;

              // Try to update deleted surface (should not trigger listener)
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // The listener should not be called for the new surface
              // because the old listener was cleaned up
              // Note: A new surface is created, but old listeners are gone
              expect(changeCount).toBe(0);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Component tree cleanup (Requirement 10.4)', () => {
      it('should clear component tree when surface is deleted', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            fc.string(),
            fc.string(),
            (surfaceId, rootId, childId, text1, text2) => {
              // Ensure unique IDs
              const safeChildId = childId === rootId ? `${childId}_child` : childId;

              processor.clearSurfaces();

              // Create surface with component tree
              const rootComp = createColumnComponent(rootId, [safeChildId]);
              const childComp = createTextComponent(safeChildId, text1);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [rootComp, childComp] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: rootId },
              });

              // Verify component tree exists
              const surfaceBefore = processor.getSurface(surfaceId);
              expect(surfaceBefore?.componentTree).not.toBeNull();
              expect(surfaceBefore?.components.size).toBe(2);

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Verify surface and all components are gone
              expect(processor.getSurface(surfaceId)).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should clear data model when surface is deleted', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            fc.string(),
            (surfaceId, key, value) => {
              processor.clearSurfaces();

              // Create surface with data model
              processor.processMessage({
                dataModelUpdate: { surfaceId, path: '/', contents: { [key]: value } },
              });

              // Verify data exists
              expect(processor.getData(surfaceId, `/${key}`)).toBe(value);

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Verify data is gone
              expect(processor.getData(surfaceId, `/${key}`)).toBeNull();
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Preserved state cleanup (Requirement 10.4)', () => {
      it('should clear preserved state when clearPreservedState is called', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            scrollPositionArb,
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
            fc.string(),
            (surfaceId, scrollPos, elementId, inputValue) => {
              // Setup preserved state
              const state = getPreservedState(surfaceId);
              state.scrollPositions.set(elementId, scrollPos);
              state.focusedElementId = elementId;
              state.pendingInputValues.set(elementId, inputValue);

              // Verify state exists
              expect(state.scrollPositions.size).toBeGreaterThan(0);
              expect(state.focusedElementId).not.toBeNull();
              expect(state.pendingInputValues.size).toBeGreaterThan(0);

              // Clear preserved state
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

    describe('Multiple surface isolation (Requirement 10.4)', () => {
      it('should not affect other surfaces when one is deleted', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            fc.string(),
            fc.string(),
            (surfaceId1, surfaceId2, compId1, compId2, text1, text2) => {
              // Ensure unique surface IDs
              const safeSurfaceId2 = surfaceId1 === surfaceId2 ? `${surfaceId2}_2` : surfaceId2;

              processor.clearSurfaces();

              // Create two surfaces
              const comp1 = createTextComponent(compId1, text1);
              const comp2 = createTextComponent(compId2, text2);

              processor.processMessage({
                surfaceUpdate: { surfaceId: surfaceId1, components: [comp1] },
              });
              processor.processMessage({
                beginRendering: { surfaceId: surfaceId1, root: compId1 },
              });

              processor.processMessage({
                surfaceUpdate: { surfaceId: safeSurfaceId2, components: [comp2] },
              });
              processor.processMessage({
                beginRendering: { surfaceId: safeSurfaceId2, root: compId2 },
              });

              // Verify both surfaces exist
              expect(processor.hasSurface(surfaceId1)).toBe(true);
              expect(processor.hasSurface(safeSurfaceId2)).toBe(true);

              // Delete first surface
              processor.processMessage({
                deleteSurface: { surfaceId: surfaceId1 },
              });

              // Verify first surface is gone, second still exists
              expect(processor.hasSurface(surfaceId1)).toBe(false);
              expect(processor.hasSurface(safeSurfaceId2)).toBe(true);

              // Verify second surface is intact
              const surface2 = processor.getSurface(safeSurfaceId2);
              expect(surface2?.componentTree).not.toBeNull();
              expect(surface2?.components.has(compId2)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should allow recreating a surface after deletion', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            fc.string(),
            fc.string(),
            (surfaceId, compId1, compId2, text1, text2) => {
              // Ensure unique component IDs
              const safeCompId2 = compId1 === compId2 ? `${compId2}_2` : compId2;

              processor.clearSurfaces();

              // Create surface
              const comp1 = createTextComponent(compId1, text1);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp1] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: compId1 },
              });

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              // Recreate surface with different component
              const comp2 = createTextComponent(safeCompId2, text2);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp2] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: safeCompId2 },
              });

              // Verify new surface exists with new component
              expect(processor.hasSurface(surfaceId)).toBe(true);
              const surface = processor.getSurface(surfaceId);
              expect(surface?.rootComponentId).toBe(safeCompId2);
              expect(surface?.components.has(safeCompId2)).toBe(true);
              // Old component should not exist
              expect(surface?.components.has(compId1)).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Delete idempotency (Requirement 10.4)', () => {
      it('should handle deleting non-existent surface gracefully', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            (surfaceId) => {
              processor.clearSurfaces();

              // Delete non-existent surface (should not throw)
              expect(() => {
                processor.processMessage({
                  deleteSurface: { surfaceId },
                });
              }).not.toThrow();

              // Surface should still not exist
              expect(processor.hasSurface(surfaceId)).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle deleting same surface multiple times', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            (surfaceId, componentId, text) => {
              processor.clearSurfaces();

              // Create surface
              const component = createTextComponent(componentId, text);
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // Delete surface multiple times (should not throw)
              expect(() => {
                processor.processMessage({ deleteSurface: { surfaceId } });
                processor.processMessage({ deleteSurface: { surfaceId } });
                processor.processMessage({ deleteSurface: { surfaceId } });
              }).not.toThrow();

              // Surface should not exist
              expect(processor.hasSurface(surfaceId)).toBe(false);
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});
