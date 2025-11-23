package handlers

import (
	"sync"

	"github.com/astercloud/aster/pkg/agent"
)

// RuntimeAgentRegistry 简单的内存 Agent 注册表，用于查询运行态信息
type RuntimeAgentRegistry struct {
	mu     sync.RWMutex
	agents map[string]*agent.Agent
}

func NewRuntimeAgentRegistry() *RuntimeAgentRegistry {
	return &RuntimeAgentRegistry{
		agents: make(map[string]*agent.Agent),
	}
}

func (r *RuntimeAgentRegistry) Register(ag *agent.Agent) {
	if ag == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[ag.ID()] = ag
}

func (r *RuntimeAgentRegistry) Unregister(agentID string) {
	if agentID == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.agents, agentID)
}

func (r *RuntimeAgentRegistry) Get(agentID string) *agent.Agent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.agents[agentID]
}
