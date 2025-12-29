/**
 * Aster UI Protocol - 标准组件白名单测试
 *
 * Feature: aster-ui-protocol
 * 验证: 需求 2.1, 2.3, 9.1, 9.2, 9.3
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  STANDARD_COMPONENTS,
  LAYOUT_COMPONENTS,
  CONTENT_COMPONENTS,
  INPUT_COMPONENTS,
  CUSTOM_COMPONENT,
  isStandardComponent,
  isLayoutComponent,
  isContentComponent,
  isInputComponent,
  registerStandardComponents,
  createStandardRegistry,
  getDefaultRegistry,
  resetDefaultRegistry,
} from '@/protocol/standard-components';
import { createComponentRegistry } from '@/protocol/registry';

describe('Standard Components', () => {
  beforeEach(() => {
    resetDefaultRegistry();
  });

  describe('Component Type Constants', () => {
    it('should define all layout components (Requirement 9.1)', () => {
      expect(LAYOUT_COMPONENTS).toContain('Row');
      expect(LAYOUT_COMPONENTS).toContain('Column');
      expect(LAYOUT_COMPONENTS).toContain('Card');
      expect(LAYOUT_COMPONENTS).toContain('List');
      expect(LAYOUT_COMPONENTS).toContain('Tabs');
      expect(LAYOUT_COMPONENTS).toContain('Modal');
      expect(LAYOUT_COMPONENTS).toContain('Divider');
      expect(LAYOUT_COMPONENTS.length).toBe(7);
    });

    it('should define all content components (Requirement 9.2)', () => {
      expect(CONTENT_COMPONENTS).toContain('Text');
      expect(CONTENT_COMPONENTS).toContain('Image');
      expect(CONTENT_COMPONENTS).toContain('Icon');
      expect(CONTENT_COMPONENTS).toContain('Video');
      expect(CONTENT_COMPONENTS).toContain('AudioPlayer');
      expect(CONTENT_COMPONENTS.length).toBe(5);
    });

    it('should define all input components (Requirement 9.3)', () => {
      expect(INPUT_COMPONENTS).toContain('Button');
      expect(INPUT_COMPONENTS).toContain('TextField');
      expect(INPUT_COMPONENTS).toContain('Checkbox');
      expect(INPUT_COMPONENTS).toContain('Select');
      expect(INPUT_COMPONENTS).toContain('DateTimeInput');
      expect(INPUT_COMPONENTS).toContain('Slider');
      expect(INPUT_COMPONENTS).toContain('MultipleChoice');
      expect(INPUT_COMPONENTS.length).toBe(7);
    });

    it('should include Custom component type (Requirement 2.3)', () => {
      expect(CUSTOM_COMPONENT).toBe('Custom');
      expect(STANDARD_COMPONENTS).toContain('Custom');
    });

    it('should have all standard components (Requirement 2.1)', () => {
      // Total: 7 layout + 5 content + 7 input + 1 custom = 20
      expect(STANDARD_COMPONENTS.length).toBe(20);

      // Verify all categories are included
      for (const component of LAYOUT_COMPONENTS) {
        expect(STANDARD_COMPONENTS).toContain(component);
      }
      for (const component of CONTENT_COMPONENTS) {
        expect(STANDARD_COMPONENTS).toContain(component);
      }
      for (const component of INPUT_COMPONENTS) {
        expect(STANDARD_COMPONENTS).toContain(component);
      }
    });
  });

  describe('Type Guard Functions', () => {
    it('should correctly identify standard components', () => {
      for (const component of STANDARD_COMPONENTS) {
        expect(isStandardComponent(component)).toBe(true);
      }
      expect(isStandardComponent('UnknownComponent')).toBe(false);
      expect(isStandardComponent('')).toBe(false);
    });

    it('should correctly identify layout components', () => {
      for (const component of LAYOUT_COMPONENTS) {
        expect(isLayoutComponent(component)).toBe(true);
      }
      expect(isLayoutComponent('Text')).toBe(false);
      expect(isLayoutComponent('Button')).toBe(false);
    });

    it('should correctly identify content components', () => {
      for (const component of CONTENT_COMPONENTS) {
        expect(isContentComponent(component)).toBe(true);
      }
      expect(isContentComponent('Row')).toBe(false);
      expect(isContentComponent('Button')).toBe(false);
    });

    it('should correctly identify input components', () => {
      for (const component of INPUT_COMPONENTS) {
        expect(isInputComponent(component)).toBe(true);
      }
      expect(isInputComponent('Row')).toBe(false);
      expect(isInputComponent('Text')).toBe(false);
    });
  });

  describe('Registry Functions', () => {
    it('should register all standard components', () => {
      const registry = createComponentRegistry();
      registerStandardComponents(registry);

      for (const component of STANDARD_COMPONENTS) {
        expect(registry.has(component)).toBe(true);
      }
      expect(registry.size()).toBe(STANDARD_COMPONENTS.length);
    });

    it('should create a standard registry with all components', () => {
      const registry = createStandardRegistry();

      for (const component of STANDARD_COMPONENTS) {
        expect(registry.has(component)).toBe(true);
      }
      expect(registry.isFrozen()).toBe(false);
    });

    it('should create a frozen standard registry when requested', () => {
      const registry = createStandardRegistry(undefined, true);

      expect(registry.isFrozen()).toBe(true);
      for (const component of STANDARD_COMPONENTS) {
        expect(registry.has(component)).toBe(true);
      }
    });

    it('should return the same default registry instance', () => {
      const registry1 = getDefaultRegistry();
      const registry2 = getDefaultRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should reset default registry', () => {
      const registry1 = getDefaultRegistry();
      resetDefaultRegistry();
      const registry2 = getDefaultRegistry();

      expect(registry1).not.toBe(registry2);
    });
  });
});
