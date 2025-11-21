/**
 * useWebSocket Composable
 * WebSocket 连接管理
 */

import { ref, onUnmounted, readonly } from 'vue';

export interface WebSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeat?: boolean;
  heartbeatInterval?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
}

export function useWebSocket(options: WebSocketOptions) {
  const {
    url,
    protocols,
    reconnect = true,
    reconnectInterval = 3000,
    reconnectAttempts = 5,
    heartbeat = true,
    heartbeatInterval = 30000,
  } = options;

  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const error = ref<Event | null>(null);
  const reconnectCount = ref(0);

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function connect() {
    if (isConnecting.value || isConnected.value) {
      return;
    }

    isConnecting.value = true;
    error.value = null;

    try {
      ws.value = new WebSocket(url, protocols);

      ws.value.onopen = (event) => {
        isConnected.value = true;
        isConnecting.value = false;
        reconnectCount.value = 0;
        
        // 启动心跳
        if (heartbeat) {
          startHeartbeat();
        }

        options.onOpen?.(event);
      };

      ws.value.onclose = (event) => {
        isConnected.value = false;
        isConnecting.value = false;
        
        // 停止心跳
        stopHeartbeat();

        options.onClose?.(event);

        // 自动重连
        if (reconnect && reconnectCount.value < reconnectAttempts) {
          reconnectCount.value++;
          reconnectTimer = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.value.onerror = (event) => {
        error.value = event;
        isConnecting.value = false;
        options.onError?.(event);
      };

      ws.value.onmessage = (event) => {
        options.onMessage?.(event);
      };
    } catch (err) {
      isConnecting.value = false;
      error.value = err as Event;
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    stopHeartbeat();
    isConnected.value = false;
    isConnecting.value = false;
  }

  function send(data: string | ArrayBuffer | Blob) {
    if (!ws.value || !isConnected.value) {
      throw new Error('WebSocket is not connected');
    }
    ws.value.send(data);
  }

  function sendJSON(data: any) {
    send(JSON.stringify(data));
  }

  function startHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    heartbeatTimer = setInterval(() => {
      if (isConnected.value) {
        try {
          sendJSON({ type: 'ping' });
        } catch (err) {
          console.error('Heartbeat failed:', err);
        }
      }
    }, heartbeatInterval);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // 自动连接
  connect();

  // 清理
  onUnmounted(() => {
    disconnect();
  });

  return {
    ws: readonly(ws),
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    error: readonly(error),
    reconnectCount: readonly(reconnectCount),
    connect,
    disconnect,
    send,
    sendJSON,
  };
}
