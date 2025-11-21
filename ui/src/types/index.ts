/**
 * AsterUI Types
 * 导出所有类型定义
 */

// Message Types
export * from './message';

// Chat Types
export * from './chat';

// Agent Types
export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  status: 'idle' | 'thinking' | 'busy' | 'error';
  metadata?: Record<string, any>;
}

// Room Types
export interface Room {
  id: string;
  name: string;
  members: RoomMember[];
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface RoomMember {
  name: string;
  agentId: string;
  avatar?: string;
  status?: string;
}

// Workflow Types
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStep?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'loop';
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  config?: Record<string, any>;
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
