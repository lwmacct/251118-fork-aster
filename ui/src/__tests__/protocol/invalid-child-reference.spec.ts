/**
 * Aster UI Protocol - Invalid Child Component Reference Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 5: Invalid Child Component Reference Handling
 *
 * Validates: Requirements 2.6
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageProcessor,
  createMessageProcessor,
} from '@/protocol/message-processor';
import { createStandardRegistry } from '@/protocol/standard-components';
import type { ComponentDefinition } from '@/types/ui-protocol';

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
 * Generate non-existent component ID (guaranteed to not exist)
 */
const nonExistentIdArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
  .map(s => `__nonexistent_${s}__`);

// ==================
// Property Tests
// ==================

describe('Invalid Child Component Reference Handling', () => {
  let processor: MessageProcessor;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Property 5: Invalid Child Component Reference Handling', () => {
    /**
     * Feature: aster-ui-protocol, Property 5: Invalid Child Component Reference Handling
     * Validates: Requirements 2.6
     *
     * For any component definition, if its referenced child component ID does not exist
     * in the component list, the renderer should handle gracefully (return null or skip)
     * without crashing.
     */

    it('should handle non-existent child references gracefully', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          nonExistentIdArb,
          (surfaceId, parentId, nonExistentChildId) => {
            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            // Create parent component with reference to non-existent child
            const parentComponent: ComponentDefinition = {
              id: parentId,
              component: {
                Row: {
                  children: {
                    explicitList: [nonExistentChildId],
                  },
                },
              },
            };

            // Add component and begin rendering
            processor.processMessage({
              surfaceUpdate: { surfaceId, components: [parentComponent] },
            });
            processor.processMessage({
              beginRendering: { surfaceId, root: parentId },
            });

            // Should not throw
            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Component tree should be built (parent exists)
            expect(surface!.componentTree).not.toBeNull();
            expect(surface!.componentTree!.id).toBe(parentId);

            // Children should be empty (non-existent child skipped)
            expect(surface!.componentTree!.children).toBeUndefined();

            // Warning should be logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              expect.stringContaining('not found'),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should skip non-existent children but include valid ones', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          componentIdArb,
          nonExistentIdArb,
          (surfaceId, parentId, validChildId, nonExistentChildId) => {
            // Ensure different IDs
            const safeValidChildId = parentId === validChildId ? `${validChildId}_child` : validChildId;

            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            // Create valid child component
            const validChild: ComponentDefinition = {
              id: safeValidChildId,
              component: {
                Text: { text: { literalString: 'valid child' } },
              },
            };

            // Create parent with both valid and invalid child references
            const parentComponent: ComponentDefinition = {
              id: parentId,
              component: {
                Row: {
                  children: {
                    explicitList: [nonExistentChildId, safeValidChildId],
                  },
                },
              },
            };

            // Add components and begin rendering
            processor.processMessage({
              surfaceUpdate: { surfaceId, components: [parentComponent, validChild] },
            });
            processor.processMessage({
              beginRendering: { surfaceId, root: parentId },
            });

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
            expect(surface!.componentTree).not.toBeNull();

            // Valid child should be included
            expect(surface!.componentTree!.children).toBeDefined();
            expect(surface!.componentTree!.children?.length).toBe(1);
            expect(surface!.componentTree!.children?.[0]?.id).toBe(safeValidChildId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle multiple non-existent child references', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          fc.array(nonExistentIdArb, { minLength: 1, maxLength: 5 }),
          (surfaceId, parentId, nonExistentChildIds) => {
            processor.clearSurfaces();

            // Create parent with multiple non-existent child references
            const parentComponent: ComponentDefinition = {
              id: parentId,
              component: {
                Row: {
                  children: {
                    explicitList: nonExistentChildIds,
                  },
                },
              },
            };

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [parentComponent] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: parentId },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
            expect(surface!.componentTree).not.toBeNull();

            // All children should be skipped
            expect(surface!.componentTree!.children).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle circular references gracefully', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          (surfaceId, componentId) => {
            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            // Create component that references itself
            const selfReferencingComponent: ComponentDefinition = {
              id: componentId,
              component: {
                Row: {
                  children: {
                    explicitList: [componentId],
                  },
                },
              },
            };

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [selfReferencingComponent] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: componentId },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
            expect(surface!.componentTree).not.toBeNull();

            // Warning about circular reference should be logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              expect.stringContaining('Circular reference'),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle deeply nested invalid references', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          componentIdArb,
          nonExistentIdArb,
          (surfaceId, grandparentId, parentId, nonExistentChildId) => {
            // Ensure different IDs
            const safeParentId = grandparentId === parentId ? `${parentId}_parent` : parentId;

            processor.clearSurfaces();

            // Create parent with invalid child reference
            const parentComponent: ComponentDefinition = {
              id: safeParentId,
              component: {
                Row: {
                  children: {
                    explicitList: [nonExistentChildId],
                  },
                },
              },
            };

            // Create grandparent with valid parent reference
            const grandparentComponent: ComponentDefinition = {
              id: grandparentId,
              component: {
                Column: {
                  children: {
                    explicitList: [safeParentId],
                  },
                },
              },
            };

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [grandparentComponent, parentComponent] },
              });
              processor.processMessage({
                beginRendering: { surfaceId, root: grandparentId },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
            expect(surface!.componentTree).not.toBeNull();

            // Grandparent should have parent as child
            expect(surface!.componentTree!.children).toBeDefined();
            expect(surface!.componentTree!.children?.length).toBe(1);
            expect(surface!.componentTree!.children?.[0]?.id).toBe(safeParentId);

            // Parent should have no children (invalid reference skipped)
            expect(surface!.componentTree!.children?.[0]?.children).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle non-existent root component gracefully', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          nonExistentIdArb,
          (surfaceId, nonExistentRootId) => {
            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            // Begin rendering with non-existent root
            expect(() => {
              processor.processMessage({
                beginRendering: { surfaceId, root: nonExistentRootId },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Component tree should be null
            expect(surface!.componentTree).toBeNull();

            // Warning should be logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              expect.stringContaining('not found'),
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
