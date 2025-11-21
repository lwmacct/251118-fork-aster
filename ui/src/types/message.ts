/**
 * 消息类型定义
 * 参考阿里云 ChatUI 设计
 */

export type MessageType = 
  | 'text'
  | 'image'
  | 'card'
  | 'list'
  | 'system'
  | 'thinking'
  | 'tool-call'
  | 'tool-result';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'error';

/**
 * 基础消息接口
 */
export interface BaseMessage {
  id: string;
  type: MessageType;
  role: MessageRole;
  createdAt: number;
  status?: MessageStatus;
  user?: User;
}

/**
 * 用户信息
 */
export interface User {
  id: string;
  name: string;
  avatar?: string;
}

/**
 * 文本消息
 */
export interface TextMessage extends BaseMessage {
  type: 'text';
  content: {
    text: string;
  };
}

/**
 * 图片消息
 */
export interface ImageMessage extends BaseMessage {
  type: 'image';
  content: {
    url: string;
    alt?: string;
    caption?: string;
    metadata?: {
      size?: number;
      dimensions?: {
        width: number;
        height: number;
      };
    };
  };
}

/**
 * 卡片消息
 */
export interface CardMessage extends BaseMessage {
  type: 'card';
  content: {
    title?: string;
    subtitle?: string;
    description?: string;
    image?: {
      url: string;
      alt?: string;
    };
    fields?: Array<{
      label: string;
      value: string;
    }>;
    actions?: CardAction[];
    footer?: string;
  };
}

export interface CardAction {
  label: string;
  action: string;
  style?: 'primary' | 'secondary';
  icon?: string;
}

/**
 * 列表消息
 */
export interface ListMessage extends BaseMessage {
  type: 'list';
  content: {
    title?: string;
    items: ListItem[];
    footer?: {
      text: string;
      action?: string;
    };
  };
}

export interface ListItem {
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  metadata?: Record<string, string>;
  action?: string;
}

/**
 * 系统消息
 */
export interface SystemMessage extends BaseMessage {
  type: 'system';
  role: 'system';
  content: {
    text: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  };
}

/**
 * 思考消息（Think-Aloud）
 */
export interface ThinkingMessage extends BaseMessage {
  type: 'thinking';
  role: 'assistant';
  content: {
    steps: ThinkingStep[];
    isActive?: boolean;
    summary?: string;
  };
}

export interface ThinkingStep {
  id?: string;
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'decision';
  content?: string;
  tool?: {
    name: string;
    args: any;
  };
  result?: any;
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  result: any;
}

export interface ApprovalRequest {
  id: string;
  toolName: string;
  args: Record<string, any>;
  reason: string;
}

/**
 * 消息联合类型
 */
export type Message =
  | TextMessage
  | ImageMessage
  | CardMessage
  | ListMessage
  | SystemMessage
  | ThinkingMessage;

/**
 * 快捷回复
 */
export interface QuickReply {
  name: string;
  text: string;
  icon?: string;
  isNew?: boolean;
  isHighlight?: boolean;
}

/**
 * 输入建议
 */
export interface Suggestion {
  text: string;
  icon?: string;
}
