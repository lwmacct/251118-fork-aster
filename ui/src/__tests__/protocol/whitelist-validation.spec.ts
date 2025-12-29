/**
 * Aster UI Protocol - Component Whitelist Validation Property Tests
 *
 * Feature: aster-ui-protocol
 * Property 3: Component Whitelist Validation
 *
 * Validates: Requirements 2.2
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageProcessor,
  createMessageProcessor,
} from '@/protocol/message-processor';
import { createStandardRegistry, STANDARD_COMPONENTS } from '@/protocol/standard-components';
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
 * Generate standard component type (in whitelist)
 */
const standardComponentTypeArb = fc.constantFrom(...STANDARD_COMPONENTS);

/**
 * Generate non-standard component type (not in whitelist)
 */
const nonStandardComponentTypeArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))
  .filter(s => !(STANDARD_COMPONENTS as readonly string[]).includes(s));

/**
 * Generate simple PropertyValue
 */
const propertyValueArb = fc.oneof(
  fc.record({ literalString: fc.string() }),
  fc.record({ literalNumber: fc.double({ noNaN: true, noDefaultInfinity: true }) }),
  fc.record({ literalBoolean: fc.boolean() }),
);

/**
 * Create a component definition with given type
 */
function createComponentWithType(id: string, type: string): ComponentDefinition {
  // Create a generic component structure
  const component: Record<string, unknown> = {};
  component[type] = { text: { literalString: 'test' } };
  return {
    id,
    component: component as ComponentDefinition['component'],
  };
}

// ==================
// Property Tests
// ==================

describe('Component Whitelist Validation', () => {
  let processor: MessageProcessor;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const registry = createStandardRegistry();
    processor = createMessageProcessor(registry);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Property 3: Component Whitelist Validation', () => {
    /**
     * Feature: aster-ui-protocol, Property 3: Component Whitelist Validation
     * Validates: Requirements 2.2
     *
     * For any component type name, if that type is not in the registry whitelist,
     * the renderer should reject that component and log a warning, without crashing.
     */

    it('should accept components with standard types', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          standardComponentTypeArb,
          (surfaceId, componentId, componentType) => {
            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            const component = createComponentWithType(componentId, componentType);

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Standard components should be added
            expect(surface!.components.has(componentId)).toBe(true);

            // No warning should be logged for standard components
            expect(consoleWarnSpy).not.toHaveBeenCalledWith(
              expect.stringContaining('Unknown component type'),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject components with non-standard types and log warning', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          nonStandardComponentTypeArb,
          (surfaceId, componentId, componentType) => {
            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            const component = createComponentWithType(componentId, componentType);

            // Should not throw (graceful handling)
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Non-standard components should NOT be added
            expect(surface!.components.has(componentId)).toBe(false);

            // Warning should be logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              expect.stringContaining('Unknown component type'),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should continue processing other components when one is rejected', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          componentIdArb,
          nonStandardComponentTypeArb,
          (surfaceId, validId, invalidId, invalidType) => {
            // Ensure different IDs
            const safeInvalidId = validId === invalidId ? `${invalidId}_invalid` : invalidId;

            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            const validComponent: ComponentDefinition = {
              id: validId,
              component: { Text: { text: { literalString: 'valid' } } },
            };
            const invalidComponent = createComponentWithType(safeInvalidId, invalidType);

            // Process both components
            processor.processMessage({
              surfaceUpdate: {
                surfaceId,
                components: [invalidComponent, validComponent],
              },
            });

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Valid component should be added
            expect(surface!.components.has(validId)).toBe(true);

            // Invalid component should NOT be added
            expect(surface!.components.has(safeInvalidId)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not crash when processing unknown component types', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          fc.array(
            fc.tuple(componentIdArb, nonStandardComponentTypeArb),
            { minLength: 1, maxLength: 10 },
          ),
          (surfaceId, componentSpecs) => {
            processor.clearSurfaces();

            const components = componentSpecs.map(([id, type], index) =>
              createComponentWithType(`${id}_${index}`, type),
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

    it('should handle Custom component type specially', () => {
      fc.assert(
        fc.property(
          surfaceIdArb,
          componentIdArb,
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
          (surfaceId, componentId, customType) => {
            processor.clearSurfaces();
            consoleWarnSpy.mockClear();

            // Custom component with a custom type
            const component: ComponentDefinition = {
              id: componentId,
              component: {
                Custom: {
                  type: customType,
                  props: {},
                },
              },
            };

            // Should not throw
            expect(() => {
              processor.processMessage({
                surfaceUpdate: { surfaceId, components: [component] },
              });
            }).not.toThrow();

            const surface = processor.getSurface(surfaceId);
            expect(surface).toBeDefined();

            // Custom components should be added (Custom is in whitelist)
            expect(surface!.components.has(componentId)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
