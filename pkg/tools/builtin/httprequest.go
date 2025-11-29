package builtin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/astercloud/aster/pkg/tools"
)

// HttpRequestTool HTTP请求工具
// 设计参考: DeepAgents deepagents-cli/tools.py:http_request
type HttpRequestTool struct {
	defaultTimeout time.Duration
	client         *http.Client
}

// NewHttpRequestTool 创建HTTP请求工具
func NewHttpRequestTool(config map[string]any) (tools.Tool, error) {
	timeout := 30 * time.Second // 默认30秒,与 DeepAgents 一致
	if t, ok := config["timeout"].(float64); ok {
		timeout = time.Duration(t) * time.Second
	}

	return &HttpRequestTool{
		defaultTimeout: timeout,
		client: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

func (t *HttpRequestTool) Name() string {
	return "HttpRequest"
}

func (t *HttpRequestTool) Description() string {
	return "Make HTTP/HTTPS requests to external APIs and websites"
}

func (t *HttpRequestTool) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"url": map[string]any{
				"type":        "string",
				"description": "Target URL (must start with http:// or https://)",
			},
			"method": map[string]any{
				"type":        "string",
				"enum":        []string{"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"},
				"description": "HTTP method (default: GET)",
			},
			"headers": map[string]any{
				"type":        "object",
				"description": "HTTP headers as key-value pairs",
			},
			"body": map[string]any{
				"type":        "string",
				"description": "Request body (for POST/PUT/PATCH)",
			},
			"timeout": map[string]any{
				"type":        "number",
				"description": "Request timeout in seconds (default: 30)",
			},
		},
		"required": []string{"url"},
	}
}

func (t *HttpRequestTool) Execute(ctx context.Context, input map[string]any, tc *tools.ToolContext) (any, error) {
	// 1. 解析参数
	url, ok := input["url"].(string)
	if !ok || url == "" {
		return nil, fmt.Errorf("url must be a non-empty string")
	}

	method := "GET"
	if m, ok := input["method"].(string); ok {
		method = m
	}

	// 2. 构建请求体
	var reqBody io.Reader
	if bodyStr, ok := input["body"].(string); ok && bodyStr != "" {
		reqBody = bytes.NewBufferString(bodyStr)
	}

	// 3. 创建HTTP请求
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	// 4. 设置请求头
	if headers, ok := input["headers"].(map[string]any); ok {
		for key, value := range headers {
			if valueStr, ok := value.(string); ok {
				req.Header.Set(key, valueStr)
			}
		}
	}

	// 默认 User-Agent
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "WriteFlow-SDK/1.0")
	}

	// 5. 自定义超时
	client := t.client
	if timeoutSec, ok := input["timeout"].(float64); ok && timeoutSec > 0 {
		client = &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		}
	}

	// 6. 发送请求
	resp, err := client.Do(req)
	if err != nil {
		// 区分超时错误
		var netErr net.Error
		if ctx.Err() == context.DeadlineExceeded || (errors.As(err, &netErr) && netErr.Timeout()) {
			return map[string]any{
				"success": false,
				"error":   fmt.Sprintf("request timeout after %v", client.Timeout),
				"url":     url,
			}, nil
		}

		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("request failed: %v", err),
			"url":     url,
		}, nil
	}
	defer func() { _ = resp.Body.Close() }()

	// 7. 读取响应体
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return map[string]any{
			"success":     false,
			"error":       fmt.Sprintf("failed to read response body: %v", err),
			"status_code": resp.StatusCode,
			"url":         url,
		}, nil
	}

	// 8. 尝试解析JSON响应
	var content any
	contentType := resp.Header.Get("Content-Type")

	// 如果是JSON,尝试解析
	if len(bodyBytes) > 0 {
		var jsonData any
		if err := json.Unmarshal(bodyBytes, &jsonData); err == nil {
			// 成功解析为JSON
			content = jsonData
		} else {
			// 返回原始文本
			content = string(bodyBytes)
		}
	} else {
		content = ""
	}

	// 9. 提取响应头
	headers := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	// 10. 返回结果(与 DeepAgents 格式对齐)
	return map[string]any{
		"success":      resp.StatusCode >= 200 && resp.StatusCode < 300,
		"status_code":  resp.StatusCode,
		"headers":      headers,
		"content":      content,
		"content_type": contentType,
		"url":          url,
	}, nil
}

func (t *HttpRequestTool) Prompt() string {
	return `Make HTTP/HTTPS requests to external APIs and websites.

Supported HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD

Guidelines:
- Always validate the URL before making requests
- Use appropriate HTTP methods for different operations
- Set proper headers (Content-Type, Authorization, etc.)
- Handle both JSON and plain text responses automatically
- Default timeout is 30 seconds (configurable via 'timeout' parameter)

Response format:
- success: boolean indicating if request was successful (2xx status)
- status_code: HTTP status code
- headers: response headers as key-value pairs
- content: parsed JSON object or plain text string
- content_type: Content-Type header value
- url: final URL (may differ from request URL due to redirects)

Security considerations:
- Only make requests to trusted URLs
- Be cautious with sensitive data in request bodies
- Review response content before processing

Example usage:
{
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer token123",
    "Accept": "application/json"
  },
  "timeout": 10
}`
}

// Examples 返回 HttpRequest 工具的使用示例
// 实现 ExampleableTool 接口，帮助 LLM 更准确地调用工具
func (t *HttpRequestTool) Examples() []tools.ToolExample {
	return []tools.ToolExample{
		{
			Description: "发送 GET 请求获取 JSON 数据",
			Input: map[string]any{
				"url":    "https://api.example.com/users/1",
				"method": "GET",
				"headers": map[string]string{
					"Accept": "application/json",
				},
			},
		},
		{
			Description: "发送 POST 请求创建资源",
			Input: map[string]any{
				"url":    "https://api.example.com/users",
				"method": "POST",
				"headers": map[string]string{
					"Content-Type":  "application/json",
					"Authorization": "Bearer token123",
				},
				"body": `{"name": "John", "email": "john@example.com"}`,
			},
		},
		{
			Description: "发送带超时的请求",
			Input: map[string]any{
				"url":     "https://slow-api.example.com/data",
				"method":  "GET",
				"timeout": 60,
			},
		},
	}
}
