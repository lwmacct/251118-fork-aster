# Changelog

## v0.14.0 (2024-11-22)

### 重大更新

- 🎉 首次发布 @aster/ui SDK
- 🧹 清理和重构 UI 目录结构
- 📦 完整的 Vue 3 + TypeScript 组件库

### 新增

- ✅ Chat 聊天组件
- ✅ Agent 管理组件
- ✅ Room 房间管理组件
- ✅ Workflow 工作流组件
- ✅ 11 个 Composables (useAsterClient, useChat, etc.)
- ✅ 完整的 TypeScript 类型定义
- ✅ 两个独立演示页面 (demo-chat.html, demo-streaming.html)

### 修复

- 🐛 修复 DeepSeek provider 流式响应处理
- 🐛 修复 WebSocket 连接失败问题（暂时禁用）
- 🐛 修复 handleStreamResponse 处理逻辑

### 改进

- 📝 更新 README 文档
- 🗑️ 删除冗余的演示文件
- 🎨 优化 App.vue 演示页面
- 📦 改进构建配置

### 删除

- ❌ 删除 examples/ 目录（不完整的演示）
- ❌ 删除 public/, server/ 目录
- ❌ 删除多余的 HTML 演示文件
- ❌ 删除过时的文档

## 目录结构

```
ui/
├── src/                # SDK 源代码
│   ├── components/     # Vue 组件
│   ├── composables/    # Composables
│   ├── types/          # TypeScript 类型
│   └── utils/          # 工具函数
├── demo-chat.html      # 基础聊天演示
├── demo-streaming.html # 流式聊天演示
├── index.html          # Vite 开发入口
├── package.json
├── vite.config.ts
└── README.md
```

## 使用方式

### 作为 SDK 使用

```bash
npm install @aster/ui
```

```vue
<script setup>
import { AsterChat } from '@aster/ui';
import '@aster/ui/style.css';
</script>

<template>
  <AsterChat :config="config" />
</template>
```

### 本地开发

```bash
cd ui
npm install
npm run dev
```

### 查看演示

启动后端后访问:
- http://localhost:8080/ui/demo-chat.html
- http://localhost:8080/ui/demo-streaming.html
