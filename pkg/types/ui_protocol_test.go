// Package types provides type definitions for the Aster framework.
package types

import (
	"encoding/json"
	"testing"
	"testing/quick"
)

// ===================
// Property 14: 跨语言序列化一致性
// Feature: aster-ui-protocol, Property 14: 跨语言序列化一致性
// 验证: 需求 8.5
//
// 对于任意有效的 TypeScript 消息对象，序列化为 JSON 并在 Go 中解析后，
// 应该产生等价的结构体；反之亦然。
// ===================

// TestAsterUIMessageRoundTrip 测试 AsterUIMessage 序列化往返
func TestAsterUIMessageRoundTrip(t *testing.T) {
	f := func(surfaceID string, root string) bool {
		if surfaceID == "" || root == "" {
			return true // Skip empty strings
		}

		original := AsterUIMessage{
			BeginRendering: &BeginRenderingMessage{
				SurfaceID: surfaceID,
				Root:      root,
				Styles:    map[string]string{"--primary-color": "#007bff"},
			},
		}

		// Serialize to JSON
		jsonBytes, err := json.Marshal(original)
		if err != nil {
			t.Logf("Marshal error: %v", err)
			return false
		}

		// Deserialize back
		var parsed AsterUIMessage
		if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
			t.Logf("Unmarshal error: %v", err)
			return false
		}

		// Verify equality
		if parsed.BeginRendering == nil {
			return false
		}
		if parsed.BeginRendering.SurfaceID != original.BeginRendering.SurfaceID {
			return false
		}
		if parsed.BeginRendering.Root != original.BeginRendering.Root {
			return false
		}

		return true
	}

	if err := quick.Check(f, &quick.Config{MaxCount: 100}); err != nil {
		t.Error(err)
	}
}

// TestSurfaceUpdateMessageRoundTrip 测试 SurfaceUpdateMessage 序列化往返
func TestSurfaceUpdateMessageRoundTrip(t *testing.T) {
	f := func(surfaceID string, componentID string, text string) bool {
		if surfaceID == "" || componentID == "" {
			return true // Skip empty strings
		}

		original := SurfaceUpdateMessage{
			SurfaceID: surfaceID,
			Components: []ComponentDefinition{
				{
					ID:     componentID,
					Weight: ComponentWeightInitial,
					Component: ComponentSpec{
						Text: &TextProps{
							Text:      NewLiteralString(text),
							UsageHint: TextUsageHintBody,
						},
					},
				},
			},
		}

		// Serialize to JSON
		jsonBytes, err := json.Marshal(original)
		if err != nil {
			t.Logf("Marshal error: %v", err)
			return false
		}

		// Deserialize back
		var parsed SurfaceUpdateMessage
		if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
			t.Logf("Unmarshal error: %v", err)
			return false
		}

		// Verify equality
		if parsed.SurfaceID != original.SurfaceID {
			return false
		}
		if len(parsed.Components) != len(original.Components) {
			return false
		}
		if parsed.Components[0].ID != original.Components[0].ID {
			return false
		}
		if parsed.Components[0].Component.Text == nil {
			return false
		}
		if !parsed.Components[0].Component.Text.Text.IsLiteralString() {
			return false
		}
		if *parsed.Components[0].Component.Text.Text.LiteralString != text {
			return false
		}

		return true
	}

	if err := quick.Check(f, &quick.Config{MaxCount: 100}); err != nil {
		t.Error(err)
	}
}

// TestDataModelUpdateMessageRoundTrip 测试 DataModelUpdateMessage 序列化往返
func TestDataModelUpdateMessageRoundTrip(t *testing.T) {
	f := func(surfaceID string, path string, value string) bool {
		if surfaceID == "" {
			return true // Skip empty strings
		}

		original := DataModelUpdateMessage{
			SurfaceID: surfaceID,
			Path:      "/" + path,
			Contents:  map[string]any{"key": value},
		}

		// Serialize to JSON
		jsonBytes, err := json.Marshal(original)
		if err != nil {
			t.Logf("Marshal error: %v", err)
			return false
		}

		// Deserialize back
		var parsed DataModelUpdateMessage
		if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
			t.Logf("Unmarshal error: %v", err)
			return false
		}

		// Verify equality
		if parsed.SurfaceID != original.SurfaceID {
			return false
		}
		if parsed.Path != original.Path {
			return false
		}

		return true
	}

	if err := quick.Check(f, &quick.Config{MaxCount: 100}); err != nil {
		t.Error(err)
	}
}

// TestDeleteSurfaceMessageRoundTrip 测试 DeleteSurfaceMessage 序列化往返
func TestDeleteSurfaceMessageRoundTrip(t *testing.T) {
	f := func(surfaceID string) bool {
		if surfaceID == "" {
			return true // Skip empty strings
		}

		original := DeleteSurfaceMessage{
			SurfaceID: surfaceID,
		}

		// Serialize to JSON
		jsonBytes, err := json.Marshal(original)
		if err != nil {
			t.Logf("Marshal error: %v", err)
			return false
		}

		// Deserialize back
		var parsed DeleteSurfaceMessage
		if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
			t.Logf("Unmarshal error: %v", err)
			return false
		}

		// Verify equality
		return parsed.SurfaceID == original.SurfaceID
	}

	if err := quick.Check(f, &quick.Config{MaxCount: 100}); err != nil {
		t.Error(err)
	}
}

// TestPropertyValueRoundTrip 测试 PropertyValue 序列化往返
func TestPropertyValueRoundTrip(t *testing.T) {
	testCases := []struct {
		name  string
		value PropertyValue
	}{
		{
			name:  "LiteralString",
			value: NewLiteralString("hello world"),
		},
		{
			name:  "LiteralNumber",
			value: NewLiteralNumber(42.5),
		},
		{
			name:  "LiteralBoolean",
			value: NewLiteralBoolean(true),
		},
		{
			name:  "PathReference",
			value: NewPathReference("/user/name"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Serialize to JSON
			jsonBytes, err := json.Marshal(tc.value)
			if err != nil {
				t.Fatalf("Marshal error: %v", err)
			}

			// Deserialize back
			var parsed PropertyValue
			if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
				t.Fatalf("Unmarshal error: %v", err)
			}

			// Verify equality based on type
			switch {
			case tc.value.IsLiteralString():
				if !parsed.IsLiteralString() || *parsed.LiteralString != *tc.value.LiteralString {
					t.Errorf("LiteralString mismatch: got %v, want %v", parsed, tc.value)
				}
			case tc.value.IsLiteralNumber():
				if !parsed.IsLiteralNumber() || *parsed.LiteralNumber != *tc.value.LiteralNumber {
					t.Errorf("LiteralNumber mismatch: got %v, want %v", parsed, tc.value)
				}
			case tc.value.IsLiteralBoolean():
				if !parsed.IsLiteralBoolean() || *parsed.LiteralBoolean != *tc.value.LiteralBoolean {
					t.Errorf("LiteralBoolean mismatch: got %v, want %v", parsed, tc.value)
				}
			case tc.value.IsPathReference():
				if !parsed.IsPathReference() || *parsed.Path != *tc.value.Path {
					t.Errorf("PathReference mismatch: got %v, want %v", parsed, tc.value)
				}
			}
		})
	}
}

// TestComponentSpecRoundTrip 测试 ComponentSpec 序列化往返
func TestComponentSpecRoundTrip(t *testing.T) {
	testCases := []struct {
		name string
		spec ComponentSpec
	}{
		{
			name: "Text",
			spec: ComponentSpec{
				Text: &TextProps{
					Text:      NewLiteralString("Hello"),
					UsageHint: TextUsageHintH1,
				},
			},
		},
		{
			name: "Button",
			spec: ComponentSpec{
				Button: &ButtonProps{
					Label:   NewLiteralString("Click me"),
					Action:  "submit",
					Variant: ButtonVariantPrimary,
				},
			},
		},
		{
			name: "Row",
			spec: ComponentSpec{
				Row: &RowProps{
					Children: ComponentArrayReference{
						ExplicitList: []string{"child1", "child2"},
					},
					Gap:   intPtr(8),
					Align: AlignmentCenter,
				},
			},
		},
		{
			name: "TextField",
			spec: ComponentSpec{
				TextField: &TextFieldProps{
					Value:       NewPathReference("/form/name"),
					Label:       propValuePtr(NewLiteralString("Name")),
					Placeholder: propValuePtr(NewLiteralString("Enter your name")),
					Multiline:   boolPtr(false),
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Serialize to JSON
			jsonBytes, err := json.Marshal(tc.spec)
			if err != nil {
				t.Fatalf("Marshal error: %v", err)
			}

			// Deserialize back
			var parsed ComponentSpec
			if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
				t.Fatalf("Unmarshal error: %v", err)
			}

			// Verify type name matches
			if parsed.GetTypeName() != tc.spec.GetTypeName() {
				t.Errorf("Type name mismatch: got %v, want %v", parsed.GetTypeName(), tc.spec.GetTypeName())
			}
		})
	}
}

// TestCrossLanguageJSONFormat 测试跨语言 JSON 格式一致性
// 验证 Go 生成的 JSON 格式与 TypeScript 期望的格式一致
func TestCrossLanguageJSONFormat(t *testing.T) {
	// Test AsterUIMessage with surfaceUpdate
	msg := AsterUIMessage{
		SurfaceUpdate: &SurfaceUpdateMessage{
			SurfaceID: "surface-1",
			Components: []ComponentDefinition{
				{
					ID:     "text-1",
					Weight: ComponentWeightInitial,
					Component: ComponentSpec{
						Text: &TextProps{
							Text:      NewLiteralString("Hello World"),
							UsageHint: TextUsageHintBody,
						},
					},
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	// Verify JSON structure
	var jsonMap map[string]any
	if err := json.Unmarshal(jsonBytes, &jsonMap); err != nil {
		t.Fatalf("Unmarshal to map error: %v", err)
	}

	// Check surfaceUpdate exists
	surfaceUpdate, ok := jsonMap["surfaceUpdate"].(map[string]any)
	if !ok {
		t.Fatal("surfaceUpdate not found or wrong type")
	}

	// Check surfaceId
	if surfaceUpdate["surfaceId"] != "surface-1" {
		t.Errorf("surfaceId mismatch: got %v", surfaceUpdate["surfaceId"])
	}

	// Check components
	components, ok := surfaceUpdate["components"].([]any)
	if !ok || len(components) != 1 {
		t.Fatal("components not found or wrong length")
	}

	comp := components[0].(map[string]any)
	if comp["id"] != "text-1" {
		t.Errorf("component id mismatch: got %v", comp["id"])
	}

	// Check component spec has Text
	compSpec := comp["component"].(map[string]any)
	textProps, ok := compSpec["Text"].(map[string]any)
	if !ok {
		t.Fatal("Text props not found")
	}

	// Check text property value
	textValue := textProps["text"].(map[string]any)
	if textValue["literalString"] != "Hello World" {
		t.Errorf("text literalString mismatch: got %v", textValue["literalString"])
	}
}

// TestIsStandardComponentType 测试标准组件类型判断
func TestIsStandardComponentType(t *testing.T) {
	// Test valid types
	validTypes := []string{"Text", "Image", "Button", "Row", "Column", "Card", "Custom"}
	for _, typeName := range validTypes {
		if !IsStandardComponentType(typeName) {
			t.Errorf("Expected %s to be a standard component type", typeName)
		}
	}

	// Test invalid types
	invalidTypes := []string{"Unknown", "InvalidType", "text", "BUTTON"}
	for _, typeName := range invalidTypes {
		if IsStandardComponentType(typeName) {
			t.Errorf("Expected %s to NOT be a standard component type", typeName)
		}
	}
}

// TestComponentSpecGetTypeName 测试组件类型名称获取
func TestComponentSpecGetTypeName(t *testing.T) {
	testCases := []struct {
		spec     ComponentSpec
		expected string
	}{
		{ComponentSpec{Text: &TextProps{}}, "Text"},
		{ComponentSpec{Image: &ImageProps{}}, "Image"},
		{ComponentSpec{Button: &ButtonProps{}}, "Button"},
		{ComponentSpec{Row: &RowProps{}}, "Row"},
		{ComponentSpec{Column: &ColumnProps{}}, "Column"},
		{ComponentSpec{Card: &CardProps{}}, "Card"},
		{ComponentSpec{List: &ListProps{}}, "List"},
		{ComponentSpec{TextField: &TextFieldProps{}}, "TextField"},
		{ComponentSpec{Checkbox: &CheckboxProps{}}, "Checkbox"},
		{ComponentSpec{Select: &SelectProps{}}, "Select"},
		{ComponentSpec{Divider: &DividerProps{}}, "Divider"},
		{ComponentSpec{Modal: &ModalProps{}}, "Modal"},
		{ComponentSpec{Tabs: &TabsProps{}}, "Tabs"},
		{ComponentSpec{Custom: &CustomProps{}}, "Custom"},
		{ComponentSpec{}, ""}, // Empty spec
	}

	for _, tc := range testCases {
		if got := tc.spec.GetTypeName(); got != tc.expected {
			t.Errorf("GetTypeName() = %v, want %v", got, tc.expected)
		}
	}
}

// Helper functions
func intPtr(i int) *int {
	return &i
}

func boolPtr(b bool) *bool {
	return &b
}

func propValuePtr(p PropertyValue) *PropertyValue {
	return &p
}
