package provider

import (
	"fmt"

	"github.com/astercloud/aster/pkg/types"
)

// ProviderFactory 提供商工厂接口
type ProviderFactory interface {
	Create(config *types.ModelConfig) (Provider, error)
}

// MultiProviderFactory 多提供商工厂
type MultiProviderFactory struct{}

// NewMultiProviderFactory 创建多提供商工厂
func NewMultiProviderFactory() *MultiProviderFactory {
	return &MultiProviderFactory{}
}

// Create 根据配置创建相应的提供商
func (f *MultiProviderFactory) Create(config *types.ModelConfig) (Provider, error) {
	providerType := config.Provider
	if providerType == "" {
		// 默认使用 anthropic
		providerType = "anthropic"
	}

	switch providerType {
	// 原有 Providers
	case "anthropic":
		return NewAnthropicProvider(config)
	case "glm", "zhipu", "bigmodel":
		return NewGLMProvider(config)
	case "deepseek":
		return NewDeepseekProvider(config)

	// 新增 OpenAI 兼容 Providers
	case "openai":
		return NewOpenAIProvider(config)
	case "groq":
		return NewGroqProvider(config)
	case "ollama":
		return NewOllamaProvider(config)
	case "openrouter":
		return NewOpenRouterProviderSimple(config)
	case "mistral":
		return NewMistralProvider(config)

	// 中国市场 Providers
	case "doubao", "bytedance":
		return NewDoubaoProviderSimple(config)
	case "moonshot", "kimi":
		return NewMoonshotProvider(config)

	// Google Providers (专有格式)
	case "gemini", "google":
		return NewGeminiProvider(config)

	// 自定义 Claude API 中转站（Anthropic 格式）
	case "custom_claude":
		return NewCustomClaudeProvider(config)

	// 通用 OpenAI 兼容 Provider（用户自定义 API）
	case "openai_compatible", "custom":
		return NewCustomProvider(config)

	default:
		// 如果提供了 BaseURL，尝试作为 OpenAI 兼容 Provider
		if config.BaseURL != "" {
			return NewCustomProvider(config)
		}
		return nil, fmt.Errorf("unsupported provider: %s", providerType)
	}
}
