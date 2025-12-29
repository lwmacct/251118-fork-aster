/**
 * Aster UI Protocol 属性测试
 *
 * Feature: aster-ui-protocol
 * Property 1: 消息序列化往返
 * 验证: 需求 1.6
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import type {
  AsterUIMessage,
  ComponentDefinition,
  ComponentSpec,
  PropertyValue,
  ComponentArrayReference,
  DataValue,
  TextProps,
  ImageProps,
  ButtonProps,
  RowProps,
  ColumnProps,
  CardProps,
  ListProps,
  TextFieldProps,
  CheckboxProps,
  SelectProps,
  DividerProps,
  ModalProps,
  TabsProps,
  CustomProps,
} from '@/types/ui-protocol';

// ==================
// Arbitrary Generators
// ==================

/**
 * 生成有效的 Surface ID
 */
const surfaceIdArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * 生成有效的组件 ID
 */
const componentIdArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * 生成 PropertyValue
 */
const propertyValueArb: fc.Arbitrary<PropertyValue> = fc.oneof(
  fc.record({ literalString: fc.string() }),
  fc.record({ literalNumber: fc.double({ noNaN: true, noDefaultInfinity: true }) }),
  fc.record({ literalBoolean: fc.boolean() }),
  fc.record({ path: fc.string({ minLength: 1 }).map(s => `/${s}`) }),
);

/**
 * 生成 ComponentArrayReference
 */
const componentArrayReferenceArb: fc.Arbitrary<ComponentArrayReference> = fc.oneof(
  fc.record({
    explicitList: fc.array(componentIdArb, { minLength: 0, maxLength: 5 }),
  }),
  fc.record({
    template: fc.record({
      componentId: componentIdArb,
      dataBinding: fc.string({ minLength: 1 }).map(s => `/${s}`),
    }),
  }),
);

/**
 * 生成 TextProps
 */
const textPropsArb: fc.Arbitrary<TextProps> = fc.record({
  text: propertyValueArb,
  usageHint: fc.option(
    fc.constantFrom('h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body' as const),
    { nil: undefined },
  ),
});

/**
 * 生成 ImageProps
 */
const imagePropsArb: fc.Arbitrary<ImageProps> = fc.record({
  src: propertyValueArb,
  alt: fc.option(propertyValueArb, { nil: undefined }),
  usageHint: fc.option(
    fc.constantFrom('icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header' as const),
    { nil: undefined },
  ),
});

/**
 * 生成 ButtonProps
 */
const buttonPropsArb: fc.Arbitrary<ButtonProps> = fc.record({
  label: propertyValueArb,
  action: fc.string({ minLength: 1, maxLength: 50 }),
  variant: fc.option(fc.constantFrom('primary', 'secondary', 'text' as const), { nil: undefined }),
  disabled: fc.option(propertyValueArb, { nil: undefined }),
});

/**
 * 生成 RowProps
 */
const rowPropsArb: fc.Arbitrary<RowProps> = fc.record({
  children: componentArrayReferenceArb,
  gap: fc.option(fc.nat(100), { nil: undefined }),
  align: fc.option(fc.constantFrom('start', 'center', 'end', 'stretch' as const), { nil: undefined }),
});

/**
 * 生成 ColumnProps
 */
const columnPropsArb: fc.Arbitrary<ColumnProps> = fc.record({
  children: componentArrayReferenceArb,
  gap: fc.option(fc.nat(100), { nil: undefined }),
  align: fc.option(fc.constantFrom('start', 'center', 'end', 'stretch' as const), { nil: undefined }),
});

/**
 * 生成 CardProps
 */
const cardPropsArb: fc.Arbitrary<CardProps> = fc.record({
  children: componentArrayReferenceArb,
  title: fc.option(propertyValueArb, { nil: undefined }),
  subtitle: fc.option(propertyValueArb, { nil: undefined }),
});

/**
 * 生成 ListProps
 */
const listPropsArb: fc.Arbitrary<ListProps> = fc.record({
  children: componentArrayReferenceArb,
  dividers: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * 生成 TextFieldProps
 */
const textFieldPropsArb: fc.Arbitrary<TextFieldProps> = fc.record({
  value: fc.record({ path: fc.string({ minLength: 1 }).map(s => `/${s}`) }),
  label: fc.option(propertyValueArb, { nil: undefined }),
  placeholder: fc.option(propertyValueArb, { nil: undefined }),
  multiline: fc.option(fc.boolean(), { nil: undefined }),
  disabled: fc.option(propertyValueArb, { nil: undefined }),
});

/**
 * 生成 CheckboxProps
 */
const checkboxPropsArb: fc.Arbitrary<CheckboxProps> = fc.record({
  checked: fc.record({ path: fc.string({ minLength: 1 }).map(s => `/${s}`) }),
  label: fc.option(propertyValueArb, { nil: undefined }),
  disabled: fc.option(propertyValueArb, { nil: undefined }),
});

/**
 * 生成 SelectProps
 */
const selectPropsArb: fc.Arbitrary<SelectProps> = fc.record({
  value: fc.record({ path: fc.string({ minLength: 1 }).map(s => `/${s}`) }),
  options: propertyValueArb,
  label: fc.option(propertyValueArb, { nil: undefined }),
  disabled: fc.option(propertyValueArb, { nil: undefined }),
});

/**
 * 生成 DividerProps
 */
const dividerPropsArb: fc.Arbitrary<DividerProps> = fc.record({
  orientation: fc.option(fc.constantFrom('horizontal', 'vertical' as const), { nil: undefined }),
});

/**
 * 生成 ModalProps
 */
const modalPropsArb: fc.Arbitrary<ModalProps> = fc.record({
  open: fc.record({ path: fc.string({ minLength: 1 }).map(s => `/${s}`) }),
  title: fc.option(propertyValueArb, { nil: undefined }),
  children: componentArrayReferenceArb,
});

/**
 * 生成 TabsProps
 */
const tabsPropsArb: fc.Arbitrary<TabsProps> = fc.record({
  activeTab: fc.record({ path: fc.string({ minLength: 1 }).map(s => `/${s}`) }),
  tabs: fc.array(
    fc.record({
      id: componentIdArb,
      label: propertyValueArb,
      content: componentArrayReferenceArb,
    }),
    { minLength: 1, maxLength: 5 },
  ),
});

/**
 * 生成 CustomProps
 */
const customPropsArb: fc.Arbitrary<CustomProps> = fc.record({
  type: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
  props: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), propertyValueArb),
});

/**
 * 生成 ComponentSpec
 */
const componentSpecArb: fc.Arbitrary<ComponentSpec> = fc.oneof(
  textPropsArb.map(props => ({ Text: props })),
  imagePropsArb.map(props => ({ Image: props })),
  buttonPropsArb.map(props => ({ Button: props })),
  rowPropsArb.map(props => ({ Row: props })),
  columnPropsArb.map(props => ({ Column: props })),
  cardPropsArb.map(props => ({ Card: props })),
  listPropsArb.map(props => ({ List: props })),
  textFieldPropsArb.map(props => ({ TextField: props })),
  checkboxPropsArb.map(props => ({ Checkbox: props })),
  selectPropsArb.map(props => ({ Select: props })),
  dividerPropsArb.map(props => ({ Divider: props })),
  modalPropsArb.map(props => ({ Modal: props })),
  tabsPropsArb.map(props => ({ Tabs: props })),
  customPropsArb.map(props => ({ Custom: props })),
);

/**
 * 生成 ComponentDefinition
 */
const componentDefinitionArb: fc.Arbitrary<ComponentDefinition> = fc.record({
  id: componentIdArb,
  weight: fc.option(fc.constantFrom('initial', 'final' as const), { nil: undefined }),
  component: componentSpecArb,
});

/**
 * 生成 DataValue (递归)
 */
const dataValueArb: fc.Arbitrary<DataValue> = fc.letrec(tie => ({
  value: fc.oneof(
    fc.string(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxDepth: 2, maxLength: 5 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), tie('value'), { maxKeys: 5 }),
  ),
})).value;

/**
 * 生成 SurfaceUpdateMessage
 */
const surfaceUpdateMessageArb = fc.record({
  surfaceId: surfaceIdArb,
  components: fc.array(componentDefinitionArb, { minLength: 1, maxLength: 10 }),
});

/**
 * 生成 DataModelUpdateMessage
 */
const dataModelUpdateMessageArb = fc.record({
  surfaceId: surfaceIdArb,
  path: fc.option(fc.string({ minLength: 1 }).map(s => `/${s}`), { nil: undefined }),
  contents: dataValueArb,
});

/**
 * 生成 BeginRenderingMessage
 */
const beginRenderingMessageArb = fc.record({
  surfaceId: surfaceIdArb,
  root: componentIdArb,
  styles: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()), { nil: undefined }),
});

/**
 * 生成 DeleteSurfaceMessage
 */
const deleteSurfaceMessageArb = fc.record({
  surfaceId: surfaceIdArb,
});

/**
 * 生成 AsterUIMessage
 */
const asterUIMessageArb: fc.Arbitrary<AsterUIMessage> = fc.oneof(
  surfaceUpdateMessageArb.map(msg => ({ surfaceUpdate: msg })),
  dataModelUpdateMessageArb.map(msg => ({ dataModelUpdate: msg })),
  beginRenderingMessageArb.map(msg => ({ beginRendering: msg })),
  deleteSurfaceMessageArb.map(msg => ({ deleteSurface: msg })),
);

// ==================
// Helper Functions
// ==================

/**
 * 规范化对象以匹配 JSON 序列化行为
 * JSON.stringify 会移除 undefined 值，并将 -0 转换为 0
 */
function normalizeForJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ==================
// Property Tests
// ==================

describe('Aster UI Protocol', () => {
  describe('Property 1: 消息序列化往返', () => {
    /**
     * Feature: aster-ui-protocol, Property 1: 消息序列化往返
     * 验证: 需求 1.6
     *
     * 对于任意有效的 AsterUIMessage 对象，将其序列化为 JSON 字符串后
     * 再解析回对象，应该产生与原始对象等价的结构。
     *
     * 注意：JSON 序列化会移除 undefined 值并将 -0 转换为 0，
     * 因此我们比较的是规范化后的对象。
     */
    it('should preserve AsterUIMessage through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(asterUIMessageArb, (message) => {
          // 序列化为 JSON 字符串
          const jsonString = JSON.stringify(message);

          // 解析回对象
          const parsed = JSON.parse(jsonString) as AsterUIMessage;

          // 验证等价性（与规范化后的原始对象比较）
          expect(parsed).toEqual(normalizeForJson(message));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve SurfaceUpdateMessage through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(surfaceUpdateMessageArb, (message) => {
          const jsonString = JSON.stringify(message);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(message));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve DataModelUpdateMessage through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(dataModelUpdateMessageArb, (message) => {
          const jsonString = JSON.stringify(message);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(message));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve BeginRenderingMessage through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(beginRenderingMessageArb, (message) => {
          const jsonString = JSON.stringify(message);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(message));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve DeleteSurfaceMessage through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(deleteSurfaceMessageArb, (message) => {
          const jsonString = JSON.stringify(message);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(message));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve ComponentDefinition through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(componentDefinitionArb, (component) => {
          const jsonString = JSON.stringify(component);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(component));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve PropertyValue through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(propertyValueArb, (value) => {
          const jsonString = JSON.stringify(value);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(value));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve DataValue through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(dataValueArb, (value) => {
          const jsonString = JSON.stringify(value);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toEqual(normalizeForJson(value));
        }),
        { numRuns: 100 },
      );
    });
  });
});
