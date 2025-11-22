#!/usr/bin/env node

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080/v1/ws';

console.log('🔌 连接到 WebSocket:', WS_URL);

const ws = new WebSocket(WS_URL, {
  headers: {
    'X-API-Key': 'dev-key-12345'
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket 已连接');
  
  // 发送聊天消息
  const message = {
    type: 'chat',
    payload: {
      template_id: 'chat',
      input: '你好，请用一句话介绍你自己',
      model_config: {
        provider: 'deepseek',
        model: 'deepseek-chat'
      }
    }
  };
  
  console.log('📤 发送消息:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('📥 收到消息:', JSON.stringify(msg, null, 2));
    
    if (msg.type === 'chat_complete') {
      console.log('✅ 聊天完成');
      ws.close();
    }
  } catch (error) {
    console.error('❌ 解析消息失败:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket 错误:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket 已断开');
  process.exit(0);
});

// 超时保护
setTimeout(() => {
  console.log('⏱️  超时，关闭连接');
  ws.close();
  process.exit(1);
}, 30000);
