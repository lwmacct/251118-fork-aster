/**
 * Aster UI Protocol - 组件注册表属性测试
 *
 * Feature: aster-ui-protocol
 * Property 4: 组件注册验证
 * Property 13: 注册表冻结
 *
 * 验证: 需求 2.4, 5.2, 5.3, 7.6
 */

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ComponentRegistry,
  RegistryError,
  RegistryErrorCodes,
  isValidTypeName,
  createComponentRegistry,
} from '@/protocol/registry';

// ==================
// Mock Component Constructor
// ==================

/**
 * 创建模拟组件构造函数
 */
function createMockConstructor(): new () => HTMLElement {
  return class MockComponent extends HTMLElement {} as unknown as new () => HTMLElement;
}

// ==================
// Arbitrary Generators
// ==================

/**
 * 生成有效的组件类型名称
 * 必须以字母开头，只能包含字母和数字
 */
const validTypeNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

/**
 * 生成无效的组件类型名称
 * 包括：以数字开头、包含特殊字符、空字符串等
 */
const invalidTypeNameArb = fc.oneof(
  // 以数字开头
  fc.tuple(fc.integer({ min: 0, max: 9 }), fc.string({ minLength: 0, maxLength: 20 }))
    .map(([num, rest]) => `${num}${rest}`),
  // 包含特殊字符
  fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => /[^a-zA-Z0-9]/.test(s) && s.length > 0),
  // 空字符串
  fc.constant(''),
  // 以下划线开头
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `_${s}`),
  // 以连字符开头
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `-${s}`),
);

// ==================
// Property Tests
// ==================

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = createComponentRegistry();
  });

  describe('Property 4: 组件注册验证', () => {
    /**
     * Feature: aster-ui-protocol, Property 4: 组件注册验证
     * 验证: 需求 2.4, 5.2, 5.3
     *
     * 对于任意组件类型名称，如果名称不是字母数字格式（以字母开头），
     * 注册应该失败并抛出错误；如果组件已注册，应该优雅处理。
     */

    it('should accept valid type names (alphanumeric starting with letter)', () => {
      fc.assert(
        fc.property(validTypeNameArb, (typeName) => {
          const newRegistry = createComponentRegistry();
          const constructor = createMockConstructor();

          // 有效名称应该成功注册
          expect(() => newRegistry.register(typeName, constructor)).not.toThrow();

          // 注册后应该能够获取
          expect(newRegistry.has(typeName)).toBe(true);
          expect(newRegistry.get(typeName)).toBe(constructor);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject invalid type names', () => {
      fc.assert(
        fc.property(invalidTypeNameArb, (typeName) => {
          const newRegistry = createComponentRegistry();
          const constructor = createMockConstructor();

          // 无效名称应该抛出错误
          expect(() => newRegistry.register(typeName, constructor)).toThrow(RegistryError);

          try {
            newRegistry.register(typeName, constructor);
          }
          catch (error) {
            expect(error).toBeInstanceOf(RegistryError);
            expect((error as RegistryError).code).toBe(RegistryErrorCodes.INVALID_TYPE_NAME);
          }

          // 不应该被注册
          expect(newRegistry.has(typeName)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should handle duplicate registration gracefully (same constructor)', () => {
      fc.assert(
        fc.property(validTypeNameArb, (typeName) => {
          const newRegistry = createComponentRegistry();
          const constructor = createMockConstructor();

          // 第一次注册
          newRegistry.register(typeName, constructor);

          // 相同构造函数的重复注册应该静默成功（幂等性）
          expect(() => newRegistry.register(typeName, constructor)).not.toThrow();

          // 仍然只有一个注册
          expect(newRegistry.getRegisteredTypes().filter(t => t === typeName).length).toBe(1);
        }),
        { numRuns: 100 },
      );
    });

    it('should handle duplicate registration gracefully (different constructor)', () => {
      fc.assert(
        fc.property(validTypeNameArb, (typeName) => {
          const newRegistry = createComponentRegistry();
          const constructor1 = createMockConstructor();
          const constructor2 = createMockConstructor();

          // 第一次注册
          newRegistry.register(typeName, constructor1);

          // 不同构造函数的重复注册应该被忽略（不覆盖）
          expect(() => newRegistry.register(typeName, constructor2)).not.toThrow();

          // 应该保留原始构造函数
          expect(newRegistry.get(typeName)).toBe(constructor1);
        }),
        { numRuns: 100 },
      );
    });

    it('should correctly report registered types', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(validTypeNameArb, { minLength: 1, maxLength: 10 }),
          (typeNames) => {
            const newRegistry = createComponentRegistry();

            // 注册所有类型
            for (const typeName of typeNames) {
              newRegistry.register(typeName, createMockConstructor());
            }

            // 验证所有类型都已注册
            const registeredTypes = newRegistry.getRegisteredTypes();
            expect(registeredTypes.length).toBe(typeNames.length);

            for (const typeName of typeNames) {
              expect(newRegistry.has(typeName)).toBe(true);
              expect(registeredTypes).toContain(typeName);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 13: 注册表冻结', () => {
    /**
     * Feature: aster-ui-protocol, Property 13: 注册表冻结
     * 验证: 需求 7.6
     *
     * 对于任意已冻结的组件注册表，尝试注册新组件应该失败并抛出错误。
     */

    it('should prevent registration after freeze', () => {
      fc.assert(
        fc.property(validTypeNameArb, (typeName) => {
          const newRegistry = createComponentRegistry();
          const constructor = createMockConstructor();

          // 冻结注册表
          newRegistry.freeze();

          // 冻结后注册应该抛出错误
          expect(() => newRegistry.register(typeName, constructor)).toThrow(RegistryError);

          try {
            newRegistry.register(typeName, constructor);
          }
          catch (error) {
            expect(error).toBeInstanceOf(RegistryError);
            expect((error as RegistryError).code).toBe(RegistryErrorCodes.REGISTRY_FROZEN);
          }

          // 不应该被注册
          expect(newRegistry.has(typeName)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should allow registration before freeze', () => {
      fc.assert(
        fc.property(
          fc.tuple(validTypeNameArb, validTypeNameArb).filter(([a, b]) => a !== b),
          ([beforeFreeze, afterFreeze]) => {
            const newRegistry = createComponentRegistry();

            // 冻结前注册
            newRegistry.register(beforeFreeze, createMockConstructor());
            expect(newRegistry.has(beforeFreeze)).toBe(true);

            // 冻结
            newRegistry.freeze();
            expect(newRegistry.isFrozen()).toBe(true);

            // 冻结后注册应该失败
            expect(() => newRegistry.register(afterFreeze, createMockConstructor())).toThrow();
            expect(newRegistry.has(afterFreeze)).toBe(false);

            // 冻结前注册的组件仍然可用
            expect(newRegistry.has(beforeFreeze)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve existing registrations after freeze', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(validTypeNameArb, { minLength: 1, maxLength: 10 }),
          (typeNames) => {
            const newRegistry = createComponentRegistry();
            const constructors = new Map<string, new () => HTMLElement>();

            // 注册所有类型
            for (const typeName of typeNames) {
              const constructor = createMockConstructor();
              constructors.set(typeName, constructor);
              newRegistry.register(typeName, constructor);
            }

            // 冻结
            newRegistry.freeze();

            // 验证所有类型仍然可用
            for (const typeName of typeNames) {
              expect(newRegistry.has(typeName)).toBe(true);
              expect(newRegistry.get(typeName)).toBe(constructors.get(typeName));
            }

            // 验证数量不变
            expect(newRegistry.size()).toBe(typeNames.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('isValidTypeName helper', () => {
    it('should return true for valid type names', () => {
      fc.assert(
        fc.property(validTypeNameArb, (typeName) => {
          expect(isValidTypeName(typeName)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should return false for invalid type names', () => {
      fc.assert(
        fc.property(invalidTypeNameArb, (typeName) => {
          expect(isValidTypeName(typeName)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });
});
