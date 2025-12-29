/**
 * Aster UI Protocol - Message Processor Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 2: Message Processing Correctness
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5
 */

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageProcessor,
  createMessageProcessor,
} from '@/protocol/message-processor';
import { createStandardRegistry } from '@/protocol/standard-components';
import type {
  AsterUIMessage,
  SurfaceUpdateMessage,
  DataModelUpdateMessage,
  BeginRenderingMessage,
  DeleteSurfaceMessage,
  ComponentDefinition,
  DataValue,
  DataMap,
} from '@/types/ui-protocol';

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
 * Generate standard component type
 */
const standardComponentTypeArb = fc.constantFrom(
  'Text', 'Image', 'Button', 'Row', 'Column', 'Card', 'List',
  'TextField', 'Checkbox', 'Select', 'Divider',
);

/**
 * Generate simple PropertyValue
 */
const propertyValueArb = fc.oneof(
  fc.record({ literalString: fc.string() }),
  fc.record({ literalNumber: fc.double({ noNaN: true, noDefaultInfinity: true }) }),
  fc.record({ literalBoolean: fc.boolean() }),
);

/**
 * Generate Text component definition
 */
const textComponentArb = fc.record({
  id: componentIdArb,
  component: fc.record({
    Text: fc.record({
      text: propertyValueArb,
      usageHint: fc.option(fc.constantFrom('h1', 'h2', 'body' as const), { nil: undefined }),
    }),
  }),
}) as fc.Arbitrary<ComponentDefinition>;

/**
 * Generate Button component definition
 */
const buttonComponentArb = fc.record({
  id: componentIdArb,
  component: fc.record({
    Button: fc.record({
      label: propertyValueArb,
      action: fc.string({ minLength: 1, maxLength: 20 }),
    }),
  }),
}) as fc.Arbitrary<ComponentDefinition>;

/**
 * Generate simple component definition
 */
const simpleComponentArb = fc.oneof(
  textComponentArb,
  buttonComponentArb,
);

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
const reservedKeys = ['constructor', 'valueOf', 'toString', 'hasOwnProperty', '__proto__', 'prototype'];
const safeKeyArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s) && !reservedKeys.includes(s));

const shallowDataMapArb: fc.Arbitrary<DataMap> = fc.dictionary(
  safeKeyArb,
  simpleDataValueArb,
  { minKeys: 1, maxKeys: 5 },
);

/**
 * Generate SurfaceUpdateMessage
 */
const surfaceUpdateMessageArb = fc.record({
  surfaceId: surfaceIdArb,
  components: fc.array(simpleComponentArb, { minLength: 1, maxLength: 5 }),
});

/**
 * Generate DataModelUpdateMessage
 */
const dataModelUpdateMessageArb = fc.record({
  surfaceId: surfaceIdArb,
  path: fc.option(fc.constant('/'), { nil: undefined }),
  contents: shallowDataMapArb,
});

/**
 * Generate BeginRenderingMessage
 */
const beginRenderingMessageArb = (componentId: string) => fc.record({
  surfaceId: surfaceIdArb,
  root: fc.constant(componentId),
  styles: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string()), { nil: undefined }),
});

/**
 * Generate DeleteSurfaceMessage
 */
const deleteSurfaceMessageArb = fc.record({
  surfaceId: surfaceIdArb,
});

// ==================
// Property Tests
// ==================

describe('MessageProcessor', () => {
  let processor: MessageProcessor;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
  });

  describe('Property 2: Message Processing Correctness', () => {
    /**
     * Feature: aster-ui-protocol, Property 2: Message Processing Correctness
     * Validates: Requirements 1.2, 1.3, 1.4, 1.5
     *
     * For any surfaceUpdate, dataModelUpdate, beginRendering, or deleteSurface message,
     * the processed Surface state should correctly reflect the message intent
     * (component tree update, data model update, rendering start, or resource cleanup).
     */

    describe('surfaceUpdate message (Requirement 1.2)', () => {
      it('should create surface and add components', () => {
        fc.assert(
          fc.property(surfaceUpdateMessageArb, (message) => {
            processor.clearSurfaces();
            processor.processMessage({ surfaceUpdate: message });

            const surface = processor.getSurface(message.surfaceId);
            expect(surface).toBeDefined();

            // All components should be added
            for (const component of message.components) {
              expect(surface!.components.has(component.id)).toBe(true);
            }
          }),
          { numRuns: 100 },
        );
      });

      it('should merge components incrementally', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            simpleComponentArb,
            simpleComponentArb,
            (surfaceId, comp1, comp2) => {
              processor.clearSurfaces();

              // First update
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp1] },
              });

              // Second update with different component
              const comp2WithDifferentId = { ...comp2, id: `${comp2.id}_2` };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp2WithDifferentId] },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();

              // Both components should exist
              expect(surface!.components.has(comp1.id)).toBe(true);
              expect(surface!.components.has(comp2WithDifferentId.id)).toBe(true);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should update existing component by ID', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            componentIdArb,
            (surfaceId, componentId) => {
              processor.clearSurfaces();

              // First update
              const comp1: ComponentDefinition = {
                id: componentId,
                component: { Text: { text: { literalString: 'first' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp1] },
              });

              // Second update with same ID
              const comp2: ComponentDefinition = {
                id: componentId,
                component: { Text: { text: { literalString: 'second' } } },
              };
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [comp2] },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();

              // Should have only one component with updated content
              expect(surface!.components.size).toBe(1);
              const stored = surface!.components.get(componentId);
              expect(stored).toEqual(comp2);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('dataModelUpdate message (Requirement 1.3)', () => {
      it('should update data model at root path', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            shallowDataMapArb,
            (surfaceId, data) => {
              processor.clearSurfaces();

              processor.processMessage({
                dataModelUpdate: { surfaceId, path: '/', contents: data },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();
              expect(surface!.dataModel).toEqual(data);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should update data model at specific path', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            safeKeyArb,
            simpleDataValueArb,
            (surfaceId, key, value) => {
              processor.clearSurfaces();

              // Initialize with empty data
              processor.processMessage({
                dataModelUpdate: { surfaceId, path: '/', contents: {} },
              });

              // Update specific path
              processor.processMessage({
                dataModelUpdate: { surfaceId, path: `/${key}`, contents: value },
              });

              const result = processor.getData(surfaceId, `/${key}`);
              expect(result).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should preserve existing data on partial update', () => {
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
                dataModelUpdate: { surfaceId, path: '/', contents: { [key1]: value1 } },
              });

              // Update second key
              processor.processMessage({
                dataModelUpdate: { surfaceId, path: `/${safeKey2}`, contents: value2 },
              });

              // Both values should exist
              expect(processor.getData(surfaceId, `/${key1}`)).toEqual(value1);
              expect(processor.getData(surfaceId, `/${safeKey2}`)).toEqual(value2);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('beginRendering message (Requirement 1.4)', () => {
      it('should set root component and build tree', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            simpleComponentArb,
            (surfaceId, component) => {
              processor.clearSurfaces();

              // Add component
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // Begin rendering
              processor.processMessage({
                beginRendering: { surfaceId, root: component.id },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();
              expect(surface!.rootComponentId).toBe(component.id);
              expect(surface!.componentTree).not.toBeNull();
              expect(surface!.componentTree!.id).toBe(component.id);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should apply styles', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            simpleComponentArb,
            fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string(), { minKeys: 1, maxKeys: 3 }),
            (surfaceId, component, styles) => {
              processor.clearSurfaces();

              // Add component
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              // Begin rendering with styles
              processor.processMessage({
                beginRendering: { surfaceId, root: component.id, styles },
              });

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();
              expect(surface!.styles).toEqual(styles);
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('deleteSurface message (Requirement 1.5)', () => {
      it('should remove surface completely', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            simpleComponentArb,
            (surfaceId, component) => {
              processor.clearSurfaces();

              // Create surface
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
              expect(processor.getSurface(surfaceId)).toBeDefined();

              // Delete surface
              processor.processMessage({
                deleteSurface: { surfaceId },
              });

              expect(processor.getSurface(surfaceId)).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should not affect other surfaces', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            surfaceIdArb,
            simpleComponentArb,
            simpleComponentArb,
            (surfaceId1, surfaceId2, comp1, comp2) => {
              // Ensure different surface IDs
              const safeSurfaceId2 = surfaceId1 === surfaceId2 ? `${surfaceId2}_2` : surfaceId2;

              processor.clearSurfaces();

              // Create two surfaces
              processor.processMessage({
                surfaceUpdate: { surfaceId: surfaceId1, components: [comp1] },
              });
              processor.processMessage({
                surfaceUpdate: { surfaceId: safeSurfaceId2, components: [comp2] },
              });

              // Delete first surface
              processor.processMessage({
                deleteSurface: { surfaceId: surfaceId1 },
              });

              // Second surface should still exist
              expect(processor.getSurface(surfaceId1)).toBeUndefined();
              expect(processor.getSurface(safeSurfaceId2)).toBeDefined();
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('processMessages batch processing', () => {
      it('should process multiple messages in order', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            simpleComponentArb,
            shallowDataMapArb,
            (surfaceId, component, data) => {
              processor.clearSurfaces();

              const messages: AsterUIMessage[] = [
                { surfaceUpdate: { surfaceId, components: [component] } },
                { dataModelUpdate: { surfaceId, path: '/', contents: data } },
                { beginRendering: { surfaceId, root: component.id } },
              ];

              processor.processMessages(messages);

              const surface = processor.getSurface(surfaceId);
              expect(surface).toBeDefined();
              expect(surface!.components.has(component.id)).toBe(true);
              expect(surface!.dataModel).toEqual(data);
              expect(surface!.rootComponentId).toBe(component.id);
              expect(surface!.componentTree).not.toBeNull();
            },
          ),
          { numRuns: 100 },
        );
      });
    });

    describe('getData and setData', () => {
      it('should get and set data correctly', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            safeKeyArb,
            simpleDataValueArb,
            (surfaceId, key, value) => {
              processor.clearSurfaces();

              // Initialize surface
              processor.processMessage({
                dataModelUpdate: { surfaceId, path: '/', contents: {} },
              });

              // Set data
              const setResult = processor.setData(surfaceId, `/${key}`, value);
              expect(setResult).toBe(true);

              // Get data
              const getResult = processor.getData(surfaceId, `/${key}`);
              expect(getResult).toEqual(value);
            },
          ),
          { numRuns: 100 },
        );
      });

      it('should return null for non-existent surface', () => {
        processor.clearSurfaces();
        expect(processor.getData('nonexistent', '/key')).toBeNull();
        expect(processor.setData('nonexistent', '/key', 'value')).toBe(false);
      });
    });

    describe('subscribe and notify', () => {
      it('should notify listeners on surface changes', () => {
        fc.assert(
          fc.property(
            surfaceIdArb,
            simpleComponentArb,
            (surfaceId, component) => {
              processor.clearSurfaces();

              let notified = false;
              const unsubscribe = processor.subscribe(surfaceId, () => {
                notified = true;
              });

              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });

              expect(notified).toBe(true);
              unsubscribe();
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});
