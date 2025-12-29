/**
 * Aster UI Protocol - Incremental Update Correctness Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 8: Incremental Update Correctness
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageProcessor,
  createMessageProcessor,
} from '@/protocol/message-processor';
import { createStandardRegistry } from '@/protocol/standard-components';
import type { ComponentDefinition, DataValue, DataMap } from '@/types/ui-protocol';

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
 * Generate safe key (avoiding reserved JS properties)
 */
const reservedKeys = ['constructor', 'valueOf', 'toString', 'hasOwnProperty', '__proto__', 'prototype'];
const safeKeyArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s) && !reservedKeys.includes(s));

/**
 * Generate simple DataValue
 */
const simpleDataValueArb: fc.Arbitrary<DataValue> = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generate shallow DataMap
 */
const shallowDataMapArb: fc.Arbitrary<DataMap> = fc.dictionary(
  safeKeyArb,
  simpleDataValueArb,
  { minKeys: 1, maxKeys: 5 },
);

/**
 * Generate Text component definition
 */
const textComponentArb = (id: string) => fc.record({
  id: fc.constant(id),
  component: fc.record({
    Text: fc.record({
      text: fc.record({ literalString: fc.string() }),
    }),
  }),
}) as fc.Arbitrary<ComponentDefinition>;

// ==================
// Property Tests
// ==================

describe('Incremental Update Correctness', () => {
  let processor: MessageProcessor;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
  });

  describe('Property 8: Incremental Update Correctness', () => {
    /**
     * Feature: aster-ui-protocol, Property 8: Incremental Update Correctness
     * Validates: Requirements 6.1, 6.2, 6.3
     *
     * For any sequence of surfaceUpdate messages for the same Surface,
     * components should be correctly merged by ID, not completely replaced;
     * partial data model updates should not replace the entire model.
     */

    describe('Component merging by ID (Requirement 6.1)', () => {
      it('should merge components from multiple surfaceUpdate messages', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            componentIdArb,
            (surfaceId, id1, id2) => {
              // Ensure different IDs
              const safeId2 = id1 === id2 ? `${id2}_2` : id2;

              processor.clearSurfaces();

              // First update with component 1
              const comp1: ComponentDefinition = {
                id: id1,
                component: { Text: { text: { literalString: 'first' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp1] },
              });

              // Second update with component 2
              const comp2: ComponentDefinition = {
                id: safeId2,
                component: { Text: { text: { literalString: 'second' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp2] },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();

              // Both components should exist (merged, not replaced)
              expect(surface!.components.size).toBe(2);
              expect(surface!.components.has(id1)).toBe(true);
              expect(surface!.components.has(safeId2)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should update existing component when same ID is used', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            fc.string(),
            fc.string(),
            (surfaceId, componentId, text1, text2) => {
              processor.clearSurfaces();

              // First update
              const comp1: ComponentDefinition = {
                id: componentId,
                component: { Text: { text: { literalString: text1 } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp1] },
              });

              // Second update with same ID
              const comp2: ComponentDefinition = {
                id: componentId,
                component: { Text: { text: { literalString: text2 } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp2] },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();

              // Should have only one component
              expect(surface!.components.size).toBe(1);

              // Component should be updated
              const stored = surface!.components.get(componentId);
              expect(stored).toEqual(comp2);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should preserve components not included in update', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            fc.array(componentIdArb, { minLength: 2, maxLength: 5 }),
            (surfaceId, componentIds) => {
              // Ensure unique IDs
              const uniqueIds = [...new Set(componentIds)];
              if (uniqueIds.length < 2) return;

              processor.clearSurfaces();

              // Add all components
              const components = uniqueIds.map((id, i) => ({
                id,
                component: { Text: { text: { literalString: `text_${i}` } } },
              } as ComponentDefinition));

              processor.processMessage({
                surfaceUpdate: { surfaceId, components },
              });

              // Update only the first component
              const firstId = uniqueIds[0]!;
              const updatedComp: ComponentDefinition = {
                id: firstId,
                component: { Text: { text: { literalString: 'updated' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [updatedComp] },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();

              // All components should still exist
              expect(surface!.components.size).toBe(uniqueIds.length);
              for (const id of uniqueIds) {
                expect(surface!.components.has(id)).toBe(true);
              }

              // First component should be updated
              const first = surface!.components.get(firstId);
              expect(first).toEqual(updatedComp);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Partial data model update (Requirement 6.2, 6.3)', () => {
      it('should update specific path without replacing entire model', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            safeKeyArb,
            safeKeyArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (surfaceId, key1, key2, value1, value2) => {
              // Ensure different keys
              const safeKey2 = key1 === key2 ? `${key2}_2` : key2;

              processor.clearSurfaces();

              // Initialize with first key
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: { [key1]: value1 },
                },
              });

              // Update second key (partial update)
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: `/${safeKey2}`,
                  contents: value2,
                },
              });

              // Both values should exist
              expect(processor.getData(surfaceId, `/${key1}`)).toEqual(value1);
              expect(processor.getData(surfaceId, `/${safeKey2}`)).toEqual(value2);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should update nested path without affecting siblings', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            safeKeyArb,
            safeKeyArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (surfaceId, parentKey, childKey, siblingValue, childValue) => {
              processor.clearSurfaces();

              // Initialize with nested structure
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: {
                    [parentKey]: {
                      sibling: siblingValue,
                    },
                  },
                },
              });

              // Update nested path
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: `/${parentKey}/${childKey}`,
                  contents: childValue,
                },
              });

              // Sibling should be preserved
              expect(processor.getData(surfaceId, `/${parentKey}/sibling`)).toEqual(siblingValue);
              // New child should exist
              expect(processor.getData(surfaceId, `/${parentKey}/${childKey}`)).toEqual(childValue);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle multiple partial updates correctly', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            fc.array(
              fc.tuple(safeKeyArb, simpleDataValueArb),
              { minLength: 2, maxLength: 5 },
            ),
            (surfaceId, updates) => {
              processor.clearSurfaces();

              // Initialize empty
              processor.processMessage({
                dataModelUpdate: { surfaceId, path: '/', contents: {} },
              });

              // Apply multiple partial updates and track final expected values
              // (last update for each key wins)
              const expectedData: DataMap = {};
              for (const [key, value] of updates) {
                processor.processMessage({
                  dataModelUpdate: {
                    surfaceId,
                    path: `/${key}`,
                    contents: value,
                  },
                });
                expectedData[key] = value;
              }

              // Check final expected values (last update for each key wins)
              for (const [key, value] of Object.entries(expectedData)) {
                expect(processor.getData(surfaceId, `/${key}`)).toEqual(value);
              }
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should replace value at specific path', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            safeKeyArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (surfaceId, key, value1, value2) => {
              processor.clearSurfaces();

              // Initialize
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: { [key]: value1 },
                },
              });

              // Update same path
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: `/${key}`,
                  contents: value2,
                },
              });

              // Value should be replaced
              expect(processor.getData(surfaceId, `/${key}`)).toEqual(value2);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Combined component and data updates', () => {
      it('should handle interleaved component and data updates', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            safeKeyArb,
            simpleDataValueArb,
            (surfaceId, componentId, dataKey, dataValue) => {
              processor.clearSurfaces();

              // Add component
              const comp: ComponentDefinition = {
                id: componentId,
                component: { Text: { text: { literalString: 'test' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp] },
              });

              // Update data
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: `/${dataKey}`,
                  contents: dataValue,
                },
              });

              // Add another component
              const comp2: ComponentDefinition = {
                id: `${componentId}_2`,
                component: { Text: { text: { literalString: 'test2' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp2] },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();

              // Both components should exist
              expect(surface!.components.has(componentId)).toBe(true);
              expect(surface!.components.has(`${componentId}_2`)).toBe(true);

              // Data should be preserved
              expect(processor.getData(surfaceId, `/${dataKey}`)).toEqual(dataValue);
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});
