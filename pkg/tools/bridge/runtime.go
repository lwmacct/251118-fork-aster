package bridge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Language 支持的语言类型
type Language string

const (
	LangPython Language = "python"
	LangNodeJS Language = "nodejs"
	LangBash   Language = "bash"
)

// CodeRuntime 代码运行时接口
type CodeRuntime interface {
	// Execute 执行代码
	Execute(ctx context.Context, code string, input map[string]interface{}) (*ExecutionResult, error)
	// Language 返回支持的语言
	Language() Language
	// IsAvailable 检查运行时是否可用
	IsAvailable() bool
}

// ExecutionResult 代码执行结果
type ExecutionResult struct {
	Success  bool        `json:"success"`
	Output   interface{} `json:"output,omitempty"`
	Stdout   string      `json:"stdout,omitempty"`
	Stderr   string      `json:"stderr,omitempty"`
	Error    string      `json:"error,omitempty"`
	ExitCode int         `json:"exit_code"`
	Duration int64       `json:"duration_ms"`
}

// RuntimeConfig 运行时配置
type RuntimeConfig struct {
	Timeout   time.Duration
	WorkDir   string
	Env       map[string]string
	MaxOutput int // 最大输出字节数
}

// DefaultRuntimeConfig 默认配置
func DefaultRuntimeConfig() *RuntimeConfig {
	return &RuntimeConfig{
		Timeout:   30 * time.Second,
		WorkDir:   os.TempDir(),
		Env:       make(map[string]string),
		MaxOutput: 1024 * 1024, // 1MB
	}
}

// PythonRuntime Python 运行时
type PythonRuntime struct {
	config     *RuntimeConfig
	pythonPath string
}

// NewPythonRuntime 创建 Python 运行时
func NewPythonRuntime(config *RuntimeConfig) *PythonRuntime {
	if config == nil {
		config = DefaultRuntimeConfig()
	}

	// 查找 Python 可执行文件
	pythonPath := "python3"
	if path, err := exec.LookPath("python3"); err == nil {
		pythonPath = path
	} else if path, err := exec.LookPath("python"); err == nil {
		pythonPath = path
	}

	return &PythonRuntime{
		config:     config,
		pythonPath: pythonPath,
	}
}

func (r *PythonRuntime) Language() Language {
	return LangPython
}

func (r *PythonRuntime) IsAvailable() bool {
	_, err := exec.LookPath(r.pythonPath)
	return err == nil
}

func (r *PythonRuntime) Execute(ctx context.Context, code string, input map[string]interface{}) (*ExecutionResult, error) {
	start := time.Now()

	// 创建临时文件
	tmpFile, err := os.CreateTemp(r.config.WorkDir, "aster_*.py")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmpFile.Name()) }()

	// 包装代码以处理输入和输出
	wrappedCode := r.wrapCode(code, input)
	if _, err := tmpFile.WriteString(wrappedCode); err != nil {
		return nil, fmt.Errorf("write code: %w", err)
	}
	_ = tmpFile.Close()

	// 创建带超时的 context
	execCtx, cancel := context.WithTimeout(ctx, r.config.Timeout)
	defer cancel()

	// 执行 Python
	cmd := exec.CommandContext(execCtx, r.pythonPath, tmpFile.Name())
	cmd.Dir = r.config.WorkDir

	// 设置环境变量
	cmd.Env = os.Environ()
	for k, v := range r.config.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	duration := time.Since(start).Milliseconds()

	result := &ExecutionResult{
		Stdout:   truncateOutput(stdout.String(), r.config.MaxOutput),
		Stderr:   truncateOutput(stderr.String(), r.config.MaxOutput),
		Duration: duration,
	}

	if err != nil {
		if execCtx.Err() == context.DeadlineExceeded {
			result.Error = "execution timeout"
			result.ExitCode = -1
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
			result.Error = stderr.String()
		} else {
			result.Error = err.Error()
			result.ExitCode = -1
		}
		return result, nil
	}

	result.Success = true
	result.ExitCode = 0

	// 尝试解析 JSON 输出
	output := strings.TrimSpace(stdout.String())
	if strings.HasPrefix(output, "{") || strings.HasPrefix(output, "[") {
		var jsonOutput interface{}
		if err := json.Unmarshal([]byte(output), &jsonOutput); err == nil {
			result.Output = jsonOutput
		} else {
			result.Output = output
		}
	} else {
		result.Output = output
	}

	return result, nil
}

func (r *PythonRuntime) wrapCode(code string, input map[string]interface{}) string {
	inputJSON, _ := json.Marshal(input)
	return fmt.Sprintf(`import json
import sys

# Input data
_input = json.loads('%s')

# User code
%s
`, string(inputJSON), code)
}

// NodeJSRuntime Node.js 运行时
type NodeJSRuntime struct {
	config   *RuntimeConfig
	nodePath string
}

// NewNodeJSRuntime 创建 Node.js 运行时
func NewNodeJSRuntime(config *RuntimeConfig) *NodeJSRuntime {
	if config == nil {
		config = DefaultRuntimeConfig()
	}

	nodePath := "node"
	if path, err := exec.LookPath("node"); err == nil {
		nodePath = path
	}

	return &NodeJSRuntime{
		config:   config,
		nodePath: nodePath,
	}
}

func (r *NodeJSRuntime) Language() Language {
	return LangNodeJS
}

func (r *NodeJSRuntime) IsAvailable() bool {
	_, err := exec.LookPath(r.nodePath)
	return err == nil
}

func (r *NodeJSRuntime) Execute(ctx context.Context, code string, input map[string]interface{}) (*ExecutionResult, error) {
	start := time.Now()

	// 创建临时文件
	tmpFile, err := os.CreateTemp(r.config.WorkDir, "aster_*.js")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmpFile.Name()) }()

	// 包装代码
	wrappedCode := r.wrapCode(code, input)
	if _, err := tmpFile.WriteString(wrappedCode); err != nil {
		return nil, fmt.Errorf("write code: %w", err)
	}
	_ = tmpFile.Close()

	// 创建带超时的 context
	execCtx, cancel := context.WithTimeout(ctx, r.config.Timeout)
	defer cancel()

	// 执行 Node.js
	cmd := exec.CommandContext(execCtx, r.nodePath, tmpFile.Name())
	cmd.Dir = r.config.WorkDir

	// 设置环境变量
	cmd.Env = os.Environ()
	for k, v := range r.config.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	duration := time.Since(start).Milliseconds()

	result := &ExecutionResult{
		Stdout:   truncateOutput(stdout.String(), r.config.MaxOutput),
		Stderr:   truncateOutput(stderr.String(), r.config.MaxOutput),
		Duration: duration,
	}

	if err != nil {
		if execCtx.Err() == context.DeadlineExceeded {
			result.Error = "execution timeout"
			result.ExitCode = -1
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
			result.Error = stderr.String()
		} else {
			result.Error = err.Error()
			result.ExitCode = -1
		}
		return result, nil
	}

	result.Success = true
	result.ExitCode = 0

	// 尝试解析 JSON 输出
	output := strings.TrimSpace(stdout.String())
	if strings.HasPrefix(output, "{") || strings.HasPrefix(output, "[") {
		var jsonOutput interface{}
		if err := json.Unmarshal([]byte(output), &jsonOutput); err == nil {
			result.Output = jsonOutput
		} else {
			result.Output = output
		}
	} else {
		result.Output = output
	}

	return result, nil
}

func (r *NodeJSRuntime) wrapCode(code string, input map[string]interface{}) string {
	inputJSON, _ := json.Marshal(input)
	return fmt.Sprintf(`// Input data
const _input = %s;

// User code
%s
`, string(inputJSON), code)
}

// BashRuntime Bash 运行时
type BashRuntime struct {
	config   *RuntimeConfig
	bashPath string
}

// NewBashRuntime 创建 Bash 运行时
func NewBashRuntime(config *RuntimeConfig) *BashRuntime {
	if config == nil {
		config = DefaultRuntimeConfig()
	}

	bashPath := "/bin/bash"
	if path, err := exec.LookPath("bash"); err == nil {
		bashPath = path
	}

	return &BashRuntime{
		config:   config,
		bashPath: bashPath,
	}
}

func (r *BashRuntime) Language() Language {
	return LangBash
}

func (r *BashRuntime) IsAvailable() bool {
	_, err := exec.LookPath(r.bashPath)
	return err == nil
}

func (r *BashRuntime) Execute(ctx context.Context, code string, input map[string]interface{}) (*ExecutionResult, error) {
	start := time.Now()

	// 创建临时文件
	tmpFile, err := os.CreateTemp(r.config.WorkDir, "aster_*.sh")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmpFile.Name()) }()

	// 包装代码
	wrappedCode := r.wrapCode(code, input)
	if _, err := tmpFile.WriteString(wrappedCode); err != nil {
		return nil, fmt.Errorf("write code: %w", err)
	}
	_ = tmpFile.Close()

	// 设置执行权限
	if err := os.Chmod(tmpFile.Name(), 0755); err != nil {
		return nil, fmt.Errorf("chmod: %w", err)
	}

	// 创建带超时的 context
	execCtx, cancel := context.WithTimeout(ctx, r.config.Timeout)
	defer cancel()

	// 执行 Bash
	cmd := exec.CommandContext(execCtx, r.bashPath, tmpFile.Name())
	cmd.Dir = r.config.WorkDir

	// 设置环境变量
	cmd.Env = os.Environ()
	for k, v := range r.config.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}
	// 将 input 作为环境变量
	for k, v := range input {
		if str, ok := v.(string); ok {
			cmd.Env = append(cmd.Env, fmt.Sprintf("INPUT_%s=%s", strings.ToUpper(k), str))
		}
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	duration := time.Since(start).Milliseconds()

	result := &ExecutionResult{
		Stdout:   truncateOutput(stdout.String(), r.config.MaxOutput),
		Stderr:   truncateOutput(stderr.String(), r.config.MaxOutput),
		Duration: duration,
	}

	if err != nil {
		if execCtx.Err() == context.DeadlineExceeded {
			result.Error = "execution timeout"
			result.ExitCode = -1
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
			result.Error = stderr.String()
		} else {
			result.Error = err.Error()
			result.ExitCode = -1
		}
		return result, nil
	}

	result.Success = true
	result.ExitCode = 0
	result.Output = strings.TrimSpace(stdout.String())

	return result, nil
}

func (r *BashRuntime) wrapCode(code string, input map[string]interface{}) string {
	inputJSON, _ := json.Marshal(input)
	return fmt.Sprintf(`#!/bin/bash
set -e

# Input as JSON (use jq to parse)
INPUT_JSON='%s'

# User code
%s
`, string(inputJSON), code)
}

// RuntimeManager 运行时管理器
type RuntimeManager struct {
	runtimes map[Language]CodeRuntime
}

// NewRuntimeManager 创建运行时管理器
func NewRuntimeManager(config *RuntimeConfig) *RuntimeManager {
	if config == nil {
		config = DefaultRuntimeConfig()
	}

	return &RuntimeManager{
		runtimes: map[Language]CodeRuntime{
			LangPython: NewPythonRuntime(config),
			LangNodeJS: NewNodeJSRuntime(config),
			LangBash:   NewBashRuntime(config),
		},
	}
}

// GetRuntime 获取指定语言的运行时
func (m *RuntimeManager) GetRuntime(lang Language) (CodeRuntime, bool) {
	runtime, exists := m.runtimes[lang]
	return runtime, exists
}

// Execute 执行代码
func (m *RuntimeManager) Execute(ctx context.Context, lang Language, code string, input map[string]interface{}) (*ExecutionResult, error) {
	runtime, exists := m.runtimes[lang]
	if !exists {
		return nil, fmt.Errorf("unsupported language: %s", lang)
	}

	if !runtime.IsAvailable() {
		return nil, fmt.Errorf("runtime not available: %s", lang)
	}

	return runtime.Execute(ctx, code, input)
}

// AvailableLanguages 返回可用的语言列表
func (m *RuntimeManager) AvailableLanguages() []Language {
	langs := make([]Language, 0)
	for lang, runtime := range m.runtimes {
		if runtime.IsAvailable() {
			langs = append(langs, lang)
		}
	}
	return langs
}

// DetectLanguage 根据文件扩展名检测语言
func DetectLanguage(filename string) Language {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".py":
		return LangPython
	case ".js", ".mjs":
		return LangNodeJS
	case ".sh", ".bash":
		return LangBash
	default:
		return ""
	}
}

// truncateOutput 截断输出
func truncateOutput(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "\n...(truncated)"
}
