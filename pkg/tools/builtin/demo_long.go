package builtin

import (
	"context"
	"sync"
	"time"

	"github.com/astercloud/aster/pkg/tools"
	"github.com/google/uuid"
)

// DemoLongTaskTool 一个用于联调的长时工具，模拟分步进度
type DemoLongTaskTool struct {
	mu     sync.RWMutex
	tasks  map[string]*tools.TaskStatus
	cancel map[string]context.CancelFunc
}

// NewDemoLongTaskTool 创建 DemoLongTaskTool
func NewDemoLongTaskTool(_ map[string]interface{}) (tools.Tool, error) {
	return &DemoLongTaskTool{
		tasks:  make(map[string]*tools.TaskStatus),
		cancel: make(map[string]context.CancelFunc),
	}, nil
}

func (t *DemoLongTaskTool) Name() string { return "DemoLongTask" }
func (t *DemoLongTaskTool) Description() string {
	return "Simulated long-running task for UI/WS integration testing"
}
func (t *DemoLongTaskTool) Prompt() string {
	return "Use to simulate a long-running task with progress events."
}

func (t *DemoLongTaskTool) InputSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"duration_ms": map[string]interface{}{
				"type":        "integer",
				"description": "Total duration of the task in milliseconds",
				"default":     5000,
				"minimum":     500,
				"maximum":     60000,
			},
			"steps": map[string]interface{}{
				"type":        "integer",
				"description": "Number of progress steps to simulate",
				"default":     5,
				"minimum":     1,
				"maximum":     20,
			},
		},
	}
}

// Execute 不直接使用，满足 Tool 接口
func (t *DemoLongTaskTool) Execute(ctx context.Context, input map[string]interface{}, tc *tools.ToolContext) (interface{}, error) {
	taskID, err := t.StartAsync(ctx, input)
	if err != nil {
		return nil, err
	}
	// 轮询直到完成
	for {
		status, err := t.GetStatus(ctx, taskID)
		if err != nil {
			return nil, err
		}
		if status.State.IsTerminal() {
			if status.State == tools.TaskStateCompleted {
				return status.Result, nil
			}
			if status.Error != nil {
				return nil, status.Error
			}
			return nil, nil
		}
		select {
		case <-ctx.Done():
			_ = t.Cancel(context.Background(), taskID)
			return nil, ctx.Err()
		case <-time.After(200 * time.Millisecond):
		}
	}
}

// IsLongRunning 标记为长时运行
func (t *DemoLongTaskTool) IsLongRunning() bool { return true }

// StartAsync 启动异步任务
func (t *DemoLongTaskTool) StartAsync(ctx context.Context, args map[string]interface{}) (string, error) {
	taskID := uuid.New().String()
	durationMs := int64(5000)
	if v, ok := args["duration_ms"].(int64); ok && v > 0 {
		durationMs = v
	}
	if v, ok := args["duration_ms"].(float64); ok && v > 0 {
		durationMs = int64(v)
	}
	steps := int64(5)
	if v, ok := args["steps"].(int64); ok && v > 0 {
		steps = v
	}
	if v, ok := args["steps"].(float64); ok && v > 0 {
		steps = int64(v)
	}

	status := &tools.TaskStatus{
		TaskID:    taskID,
		State:     tools.TaskStatePending,
		Progress:  0,
		StartTime: time.Now(),
		Metadata: map[string]interface{}{
			"duration_ms": durationMs,
			"steps":       steps,
		},
	}

	taskCtx, cancel := context.WithCancel(ctx)

	t.mu.Lock()
	t.tasks[taskID] = status
	t.cancel[taskID] = cancel
	t.mu.Unlock()

	go func() {
		defer cancel()
		stepDuration := time.Duration(durationMs/steps) * time.Millisecond

		t.updateStatus(taskID, func(s *tools.TaskStatus) {
			s.State = tools.TaskStateRunning
		})

		for i := int64(1); i <= steps; i++ {
			select {
			case <-taskCtx.Done():
				t.updateStatus(taskID, func(s *tools.TaskStatus) {
					s.State = tools.TaskStateCancelled
					now := time.Now()
					s.EndTime = &now
					if s.Error == nil {
						s.Error = context.Canceled
					}
				})
				return
			case <-time.After(stepDuration):
				progress := float64(i) / float64(steps)
				t.updateStatus(taskID, func(s *tools.TaskStatus) {
					s.Progress = progress
					if s.Metadata == nil {
						s.Metadata = make(map[string]interface{})
					}
					s.Metadata["step"] = i
					s.Metadata["total"] = steps
				})
			}
		}

		t.updateStatus(taskID, func(s *tools.TaskStatus) {
			s.State = tools.TaskStateCompleted
			s.Progress = 1.0
			s.Result = map[string]interface{}{
				"ok":      true,
				"message": "demo long task completed",
			}
			now := time.Now()
			s.EndTime = &now
		})
	}()

	return taskID, nil
}

// GetStatus 获取任务状态
func (t *DemoLongTaskTool) GetStatus(_ context.Context, taskID string) (*tools.TaskStatus, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if s, ok := t.tasks[taskID]; ok {
		// 返回副本避免外部修改
		copy := *s
		return &copy, nil
	}
	return nil, ErrTaskNotFound{TaskID: taskID}
}

// Cancel 取消任务
func (t *DemoLongTaskTool) Cancel(_ context.Context, taskID string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	cancel, ok := t.cancel[taskID]
	if !ok {
		return ErrTaskNotFound{TaskID: taskID}
	}
	cancel()
	return nil
}

// ErrTaskNotFound 任务不存在错误
type ErrTaskNotFound struct {
	TaskID string
}

func (e ErrTaskNotFound) Error() string {
	return "task not found: " + e.TaskID
}

func (t *DemoLongTaskTool) updateStatus(taskID string, fn func(*tools.TaskStatus)) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if s, ok := t.tasks[taskID]; ok {
		fn(s)
	}
}
