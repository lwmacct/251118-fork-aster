/**
 * Aster UI Protocol - Invalid Props Tolerance Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 12: 无效属性容错
 *
 * Validates: Requirements 7.4
 *
 * 对于任意包含无效或格式错误属性的组件，渲染器应该跳过该组件并继续渲染其他组件，
 * 而不是整体失败。
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageProcessor,
  createMessageProcessor,
} from '@/protocol/message-processor';
import { createStandardRegistry } from '@/protocol/standard-components';
import type { ComponentDefinition, PropertyValue } from '@/types/ui-protocol';
import {
  ProtocolError,
  ErrorCodes,
  isProtocolError,
  createInvalidPropsError,
} from '@/protocol/errors';

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
 * Generate valid PropertyValue
 */
const validPropertyValueArb: fc.Arbitrary<PropertyValue> = fc.oneof(
  fc.record({ literalString: fc.string() }),
  fc.record({ literalNumber: fc.double({ noNaN: true, noDefaultInfinity: true }) }),
  fc.record({ literalBoolean: fc.boolean() }),
  fc.record({ path: fc.constant('/data/value') }),
);

/**
 * Generate invalid PropertyValue (malformed structure)
 */
const invalidPropertyValueArb = fc.oneof(
  // Missing required fields
  fc.constant({}),
  // Multiple conflicting fields
  fc.record({
    literalString: fc.string(),
    literalNumber: fc.double({ noNaN: true, noDefaultInfinity: true }),
  }),
  // Wrong type for literalString
  fc.record({ literalString: fc.double({ noNaN: true, noDefaultInfinity: true }) }),
  // Wrong type for literalNumber
  fc.record({ literalNumber: fc.string() }),
  // Wrong type for literalBoolean
  fc.record({ literalBoolean: fc.string() }),
  // Invalid path type
  fc.record({ path: fc.double({ noNaN: true, noDefaultInfinity: true }) }),
  // Null value
  fc.constant(null),
  // Undefined value
  fc.constant(undefined),
  // Array instead of object
  fc.array(fc.string()),
);

/**
 * Generate valid Text component
 */
const validTextComponentArb = fc.record({
  id: componentIdArb,
  component: fc.record({
    Text: fc.record({
      text: validPropertyValueArb,
      usageHint: fc.option(fc.constantFrom('h1', 'h2', 'body' as const), { nil: undefined }),
    }),
  }),
}) as fc.Arbitrary<ComponentDefinition>;

/**
 * Generate valid Button component
 */
const validButtonComponentArb = fc.record({
  id: componentIdArb,
  component: fc.record({
    Button: fc.record({
      label: validPropertyValueArb,
      action: fc.string({ minLength: 1, maxLength: 20 }),
    }),
  }),
}) as fc.Arbitrary<ComponentDefinition>;

/**
 * Generate valid component
 */
const validComponentArb = fc.oneof(
  validTextComponentArb,
  validButtonComponentArb,
);

/**
 * Create a component with invalid props
 */
function createComponentWithInvalidProps(id: string, invalidProps: unknown): ComponentDefinition {
  return {
    id,
    component: {
      Text: invalidProps as { text: PropertyValue },
    },
  };
}

/**
 * Create a component with missing required props
 */
function createComponentWithMissingProps(id: string): ComponentDefinition {
  return {
    id,
    component: {
      Text: {} as { text: PropertyValue },
    },
  };
}

/**
 * Create a component with null props
 */
function createComponentWithNullProps(id: string): ComponentDefinition {
  return {
    id,
    component: {
      Text: null as unknown as { text: PropertyValue },
    },
  };
}

// ==================
// Property Tests
// ==================

describe('Invalid Props Tolerance', () => {
  let processor: MessageProcessor;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Property 12: 无效属性容错', () => {
    /**
     * Feature: aster-ui-protocol, Property 12: 无效属性容错
     * Validates: Requirements 7.4
     *
     * 对于任意包含无效或格式错误属性的组件，渲染器应该跳过该组件并继续渲染其他组件，
     * 而不是整体失败。
     */

    it('should not crash when processing components with invalid props', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          invalidPropertyValueArb,
          (surfaceId, componentId, invalidProps) => {
            processor.clearSurfaces();

            const component = createComponentWithInvalidProps(componentId, { text: invalidProps });

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
            }).not.toThrow();

            // Processor should still be functional
            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should continue processing valid components after encountering invalid ones', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          componentIdArb,
          invalidPropertyValueArb,
          (surfaceId, validId, invalidId, invalidProps) => {
            // Ensure different IDs
            const safeInvalidId = validId === invalidId ? `${invalidId}_invalid` : invalidId;

            processor.clearSurfaces();

            const validComponent: ComponentDefinition = {
              id: validId,
              component: { Text: { text: { literalString: 'valid text' } } },
            };
            const invalidComponent = createComponentWithInvalidProps(safeInvalidId, { text: invalidProps });

            // Process both components - invalid first, then valid
            processor.processMessage({
              surfaceUpdate: {
                surfaceId,
                components: [invalidComponent, validComponent],
              },
            });

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Valid component should be added regardless of invalid component
            expect(surface!.components.has(validId)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle components with missing required props gracefully', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          (surfaceId, componentId) => {
            processor.clearSurfaces();

            const component = createComponentWithMissingProps(componentId);

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
            }).not.toThrow();

            // Processor should still be functional
            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle components with null props gracefully', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          (surfaceId, componentId) => {
            processor.clearSurfaces();

            const component = createComponentWithNullProps(componentId);

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
            }).not.toThrow();

            // Processor should still be functional
            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should process multiple invalid components without crashing', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          fc.array(
            fc.tuple(componentIdArb, invalidPropertyValueArb),
            { minLength: 1, maxLength: 10 },
          ),
          (surfaceId, componentSpecs) => {
            processor.clearSurfaces();

            const components = componentSpecs.map(([id, invalidProps], index) =>
              createComponentWithInvalidProps(`${id}_${index}`, { text: invalidProps }),
            );

            // Should never throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components },
              });
            }).not.toThrow();

            // Processor should still be functional
            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain surface state integrity after processing invalid components', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          validComponentArb,
          componentIdArb,
          invalidPropertyValueArb,
          (surfaceId, validComponent, invalidId, invalidProps) => {
            // Ensure different IDs
            const safeInvalidId = validComponent.id === invalidId ? `${invalidId}_invalid` : invalidId;

            processor.clearSurfaces();

            // First, add a valid component
            processor.processMessage({
              surfaceUpdate: { surfaceId, components: [validComponent] },
            });

            // Then, try to add an invalid component
            const invalidComponent = createComponentWithInvalidProps(safeInvalidId, { text: invalidProps });
            processor.processMessage({
              surfaceUpdate: { surfaceId, components: [invalidComponent] },
            });

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Original valid component should still be present
            expect(surface!.components.has(validComponent.id)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle mixed valid and invalid components in same batch', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          fc.array(validComponentArb, { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.tuple(componentIdArb, invalidPropertyValueArb),
            { minLength: 1, maxLength: 5 },
          ),
          (surfaceId, validComponents, invalidSpecs) => {
            processor.clearSurfaces();

            // Create unique IDs for invalid components
            const invalidComponents = invalidSpecs.map(([id, invalidProps], index) =>
              createComponentWithInvalidProps(`invalid_${id}_${index}`, { text: invalidProps }),
            );

            // Mix valid and invalid components
            const allComponents = [...invalidComponents, ...validComponents];

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: allComponents },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // All valid components should be present
            for (const validComponent of validComponents) {
              expect(surface!.components.has(validComponent.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should be able to render component tree even with some invalid components', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          validComponentArb,
          componentIdArb,
          invalidPropertyValueArb,
          (surfaceId, validComponent, invalidId, invalidProps) => {
            // Ensure different IDs
            const safeInvalidId = validComponent.id === invalidId ? `${invalidId}_invalid` : invalidId;

            processor.clearSurfaces();

            const invalidComponent = createComponentWithInvalidProps(safeInvalidId, { text: invalidProps });

            // Add both components
            processor.processMessage({
              surfaceUpdate: { surfaceId, components: [invalidComponent, validComponent] },
            });

            // Begin rendering with valid component as root
            processor.processMessage({
              beginRendering: { surfaceId, root: validComponent.id },
            });

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();
            expect(surface!.rootComponentId).toBe(validComponent.id);
            expect(surface!.componentTree).not.toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('ProtocolError class', () => {
    it('should create error with correct properties', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(...Object.values(ErrorCodes)),
          fc.dictionary(fc.string(), fc.string()),
          (message, code, details) => {
            const error = new ProtocolError(message, code, details);

            expect(error.message).toBe(message);
            expect(error.code).toBe(code);
            expect(error.details).toEqual(details);
            expect(error.name).toBe('ProtocolError');
            expect(error instanceof Error).toBe(true);
            expect(error instanceof ProtocolError).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should serialize to JSON correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(...Object.values(ErrorCodes)),
          fc.dictionary(fc.string(), fc.string()),
          (message, code, details) => {
            const error = new ProtocolError(message, code, details);
            const json = error.toJSON();

            expect(json.name).toBe('ProtocolError');
            expect(json.message).toBe(message);
            expect(json.code).toBe(code);
            expect(json.details).toEqual(details);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should convert to string correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(...Object.values(ErrorCodes)),
          (message, code) => {
            const error = new ProtocolError(message, code);
            const str = error.toString();

            expect(str).toContain('ProtocolError');
            expect(str).toContain(code);
            expect(str).toContain(message);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should be identifiable with isProtocolError', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(...Object.values(ErrorCodes)),
          (message, code) => {
            const protocolError = new ProtocolError(message, code);
            const regularError = new Error(message);

            expect(isProtocolError(protocolError)).toBe(true);
            expect(isProtocolError(regularError)).toBe(false);
            expect(isProtocolError(null)).toBe(false);
            expect(isProtocolError(undefined)).toBe(false);
            expect(isProtocolError('string')).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Error factory functions', () => {
    it('should create invalid props error correctly', () => {
      fc.assert(
        fc.property(
          componentIdArb,
          fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          (componentId, propName) => {
            const error = createInvalidPropsError(componentId, propName);

            expect(error.code).toBe(ErrorCodes.INVALID_PROPS);
            expect(error.details?.componentId).toBe(componentId);
            if (propName) {
              expect(error.details?.propName).toBe(propName);
              expect(error.message).toContain(propName);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
