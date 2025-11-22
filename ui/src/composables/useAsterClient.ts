/**
 * Aster Client Composable
 * 封装 @aster/client-js SDK 供 Vue3 使用
 */

import { ref, onUnmounted } from 'vue';
import { aster, WebSocketClient, SubscriptionManager } from '@aster/client-js';

export interface AsterClientConfig {
  baseUrl?: string;
  apiKey?: string;
  wsUrl?: string;
}

export function useAsterClient(config: AsterClientConfig = {}) {
  const baseUrl = config.baseUrl || 'http://localhost:8080';
  // 创建 Aster Client
  const client = new aster({
    baseUrl,
    apiKey: config.apiKey,
  });

  // WebSocket 状态
  const ws = ref<WebSocketClient | null>(null);
  const isConnected = ref(false);
  const subscriptionManager = ref<SubscriptionManager | null>(null);

  // 初始化 WebSocket
  const initWebSocket = async () => {
    try {
      // 构建 WebSocket URL
      const wsUrl = config.wsUrl || baseUrl.replace(/^http/, 'ws') + '/v1/ws';
      
      ws.value = new WebSocketClient({
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        heartbeatInterval: 30000,
      });

      await ws.value.connect(wsUrl);
      isConnected.value = true;
      
      subscriptionManager.value = new SubscriptionManager(ws.value);
      
      console.log('✅ Aster WebSocket connected to', wsUrl);
      console.log('✅ ws.value:', ws.value);
      console.log('✅ isConnected.value:', isConnected.value);
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      isConnected.value = false;
    }
  };

  // 订阅事件
  const subscribe = (
    channels: ('progress' | 'control' | 'monitor')[],
    filter?: { agentId?: string; eventTypes?: string[] }
  ) => {
    if (!subscriptionManager.value) {
      throw new Error('WebSocket not initialized');
    }
    return subscriptionManager.value.subscribe(channels, filter);
  };

  // 断开连接
  const disconnect = () => {
    if (ws.value) {
      ws.value.disconnect();
      ws.value = null;
      isConnected.value = false;
    }
  };

  // 生命周期
  onUnmounted(() => {
    disconnect();
  });

  return {
    client,
    ws,
    isConnected,
    subscribe,
    disconnect,
    reconnect: initWebSocket,
  };
}
