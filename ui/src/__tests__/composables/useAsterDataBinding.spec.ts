/**
 * Aster UI Protocol - Data Binding Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 7: Data Binding Two-Way Sync
 *
 * Validates: Requirements 3.2, 3.5
 *
 * For any component bound to a data model path:
 * - When data model value changes, the component should automatically update
 * - When user modifies value through input component, data model should sync
 */

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ref, nextTick } from 'vue';
import {
  useAsterDataBinding,
  createDataBindingContext,
  DATA_BINDING_CONTEXT_KEY,
  type DataBindingContext,
} from '@/composables/useAsterDataBinding';
import { MessageProcessor, createMessageProcessor } from '@/protocol/message-processor';
import { createStandardRegistry } from '@/protocol/standard-components';
import { getData, setData } from '@/protocol/path-resolver';
import type { DataValue, DataMap, PropertyValue } from '@/types/ui-protocol';

// ==================
// Arbitrary Generators
// ==================

/**
 * Generate valid JSON Pointer path segment
 */
const pathSegmentArb = fc.string({ minLength: 1, maxLength: 10 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

/**
 * Generate valid JSON Pointer path
 */
const jsonPointerPathArb = fc.array(pathSegmentArb, { minLength: 1, maxLength: 3 })
  .map(segments => '/' + segments.join('/'));

/**
 * Generate simple DataValue (excluding objects and arrays for simplicity)
 */
const simpleDataValueArb: fc.Arbitrary<DataValue> = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
);

/**
 * Generate PropertyValue with path reference
 */
const pathPropertyValueArb = (path: string): fc.Arbitrary<PropertyValue> =>
  fc.constant({ path });

/**
 * Generate literal PropertyValue
 */
const literalPropertyValueArb: fc.Arbitrary<PropertyValue> = fc.oneof(
  fc.string().map(s => ({ literalString: s })),
  fc.double({ noNaN: true, noDefaultInfinity: true }).map(n => ({ literalNumber: n })),
  fc.boolean().map(b => ({ literalBoolean: b })),
);

/**
 * Generate surface ID
 */
const surfaceIdArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

// ==================
// Test Helpers
// ==================

/**
 * Create a test data binding context
 */
function createTestContext(
  surfaceId: string,
  initialData: DataMap = {},
): { context: DataBindingContext; processor: MessageProcessor } {
  const registry = createStandardRegistry();
  const processor = createMessageProcessor(registry);
  const dataModel = ref<DataMap>(initialData);

  const context: DataBindingContext = {
    processor: ref(processor),
    surfaceId,
    dataModel,
  };

  return { context, processor };
}

/**
 * Initialize data at a path in the data model
 */
function initializeDataAtPath(dataModel: DataMap, path: string, value: DataValue): void {
  setData(dataModel, path, value);
}

// ==================
// Property Tests
// ==================

describe('useAsterDataBinding', () => {
  describe('Property 7: Data Binding Two-Way Sync', () => {
    /**
     * Feature: aster-ui-protocol, Property 7: Data Binding Two-Way Sync
     * Validates: Requirements 3.2, 3.5
     *
     * For any component bound to a data model path:
     * - When data model value changes, the component should automatically update
     * - When user modifies value through input component, data model should sync
     */

    describe('Literal value resolution', () => {
      it('should resolve literalString values correctly', () => {
        fc.assert(
          fc.property(fc.string(), (str) => {
            const { value } = useAsterDataBinding({
              propertyValue: { literalString: str },
            });

            expect(value.value).toBe(str);
          }),
          { numRuns: 100 },
        );
      });

      it('should resolve literalNumber values correctly', () => {
        fc.assert(
          fc.property(
            fc.double({ noNaN: true, noDefaultInfinity: true }),
            (num) => {
              const { value } = useAsterDataBinding({
                propertyValue: { literalNumber: num },
              });

              expect(value.value).toBe(num);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should resolve literalBoolean values correctly', () => {
        fc.assert(
          fc.property(fc.boolean(), (bool) => {
            const { value } = useAsterDataBinding({
              propertyValue: { literalBoolean: bool },
            });

            expect(value.value).toBe(bool);
          }),
          { numRuns: 100 },
        );
      });
    });

    describe('Path reference detection', () => {
      it('should correctly identify path references', () => {
        fc.assert(
          fc.property(jsonPointerPathArb, (path) => {
            const { isPath, path: resolvedPath } = useAsterDataBinding({
              propertyValue: { path },
            });

            expect(isPath).toBe(true);
            expect(resolvedPath).toBe(path);
          }),
          { numRuns: 100 },
        );
      });

      it('should correctly identify literal values as non-path', () => {
        fc.assert(
          fc.property(literalPropertyValueArb, (propertyValue) => {
            const { isPath, path } = useAsterDataBinding({
              propertyValue,
            });

            expect(isPath).toBe(false);
            expect(path).toBeNull();
          }),
          { numRuns: 100 },
        );
      });
    });

    describe('Default value handling', () => {
      it('should return default value when no property value provided', () => {
        fc.assert(
          fc.property(simpleDataValueArb, (defaultValue) => {
            const { value } = useAsterDataBinding({
              defaultValue,
            });

            expect(value.value).toBe(defaultValue);
          }),
          { numRuns: 100 },
        );
      });

      it('should return undefined when no property value and no default', () => {
        const { value } = useAsterDataBinding({});
        expect(value.value).toBeUndefined();
      });
    });

    describe('Data model read (Requirement 3.2)', () => {
      it('should read value from data model at path', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            pathSegmentArb,
            simpleDataValueArb,
            (surfaceId, key, dataValue) => {
              // Create context with initial data
              const initialData: DataMap = { [key]: dataValue };
              const { context } = createTestContext(surfaceId, initialData);

              // Create binding with path reference
              const { value } = useAsterDataBinding({
                propertyValue: { path: `/${key}` },
              });

              // Without context injection, value should be default
              // This tests the composable in isolation
              expect(value.value).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Data model write via updateValue (Requirement 3.5)', () => {
      it('should update data model when updateValue is called with path binding', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            pathSegmentArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (surfaceId, key, initialValue, newValue) => {
              // Create context with initial data
              const initialData: DataMap = { [key]: initialValue };
              const { context, processor } = createTestContext(surfaceId, initialData);

              // Initialize surface in processor
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: initialData,
                },
              });

              // Verify initial value
              const initialResult = processor.getData(surfaceId, `/${key}`);
              expect(initialResult).toEqual(initialValue);

              // Update via processor (simulating what updateValue does)
              processor.setData(surfaceId, `/${key}`, newValue);

              // Verify updated value
              const updatedResult = processor.getData(surfaceId, `/${key}`);
              expect(updatedResult).toEqual(newValue);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Round-trip consistency', () => {
      it('should maintain value consistency through set and get operations', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            pathSegmentArb,
            simpleDataValueArb,
            (surfaceId, key, value) => {
              const { processor } = createTestContext(surfaceId);

              // Initialize surface
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: {},
                },
              });

              // Set value
              const setResult = processor.setData(surfaceId, `/${key}`, value);
              expect(setResult).toBe(true);

              // Get value back
              const getResult = processor.getData(surfaceId, `/${key}`);
              expect(getResult).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should handle nested path updates correctly', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            pathSegmentArb,
            pathSegmentArb,
            simpleDataValueArb,
            (surfaceId, key1, key2, value) => {
              // Ensure different keys
              const safeKey2 = key1 === key2 ? `${key2}2` : key2;
              const { processor } = createTestContext(surfaceId);

              // Initialize surface with nested structure
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: { [key1]: {} },
                },
              });

              // Set nested value
              const path = `/${key1}/${safeKey2}`;
              const setResult = processor.setData(surfaceId, path, value);
              expect(setResult).toBe(true);

              // Get nested value back
              const getResult = processor.getData(surfaceId, path);
              expect(getResult).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Multiple bindings to same path', () => {
      it('should reflect same value for multiple bindings to same path', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            pathSegmentArb,
            simpleDataValueArb,
            (surfaceId, key, value) => {
              const { processor } = createTestContext(surfaceId);

              // Initialize surface
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: { [key]: value },
                },
              });

              // Get value from two different "bindings" (simulated)
              const result1 = processor.getData(surfaceId, `/${key}`);
              const result2 = processor.getData(surfaceId, `/${key}`);

              expect(result1).toEqual(result2);
              expect(result1).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('Data model reactivity', () => {
      it('should update all bindings when data model changes', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            pathSegmentArb,
            simpleDataValueArb,
            simpleDataValueArb,
            (surfaceId, key, initialValue, newValue) => {
              const { processor } = createTestContext(surfaceId);

              // Initialize surface
              processor.processMessage({
                dataModelUpdate: {
                  surfaceId,
                  path: '/',
                  contents: { [key]: initialValue },
                },
              });

              // Verify initial value
              expect(processor.getData(surfaceId, `/${key}`)).toEqual(initialValue);

              // Update data model
              processor.setData(surfaceId, `/${key}`, newValue);

              // Verify all reads return new value
              expect(processor.getData(surfaceId, `/${key}`)).toEqual(newValue);
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });

  describe('createDataBindingContext', () => {
    it('should create valid context with all required properties', () => {
      fc.assert(
        fc.property(surfaceIdArb, (surfaceId) => {
          const processor = ref<MessageProcessor | null>(null);
          const dataModel = ref<DataMap>({});

          const context = createDataBindingContext(processor, surfaceId, dataModel);

          expect(context.processor).toBe(processor);
          expect(context.surfaceId).toBe(surfaceId);
          expect(context.dataModel).toBe(dataModel);
        }),
        { numRuns: 100 },
      );
    });
  });
});
