# @aster/ui

重构后的 `ui` 目录是一个 **ChatUI 风格的 Agent 体验站**：既可以作为销售/合作演示，也可以直接供前端团队参考 SDK 与代码结构。站点整合了 Hero、能力亮点、可切换的 Playground、Builder 指南以及文档链接，所有内容都运行在单一的 Vue 3 + Vite 应用中。

## 目录结构

```
ui/
├── src/
│   ├── App.vue             # ChatUI 风格的单页站点
│   ├── components/         # AsterChat 及配套 UI 组件
│   ├── composables/        # useChat、useAsterClient 等逻辑封装
│   ├── types/              # 类型定义（消息、Agent、配置）
│   ├── utils/              # 通用工具方法
│   └── main.ts             # Vite 入口
├── public/                 # 可选静态资源
├── package.json
├── tailwind.config.js
├── tsconfig*.json
└── vite.config.ts
```

> 旧的 `demo-chat.html` / `demo-streaming.html` 已被清理，相关体验已经并入新的 landing site 与 `AsterChat` 组件。

## 快速开始

```bash
cd ui
npm install
npm run dev      # http://localhost:3000
```

构建生产包：

```bash
npm run build
```

发布时会生成 `dist/`，其中包含 `aster-ui.es.js`、`aster-ui.umd.js`、`style.css` 与类型声明。

## AsterChat 配置示例

```vue
<script setup lang="ts">
import { AsterChat } from '@aster/ui';
import '@aster/ui/style.css';

const httpConfig = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'demo-key',
  agentId: 'builder',
  enableThinking: true,
  enableApproval: true,
  demoMode: false,           // 设为 false 即可调用真实后端
};
</script>

<template>
  <AsterChat :config="httpConfig" />
</template>
```

Landing 页面默认将 `demoMode` 设为 `true`，因此在没有 Aster Server 的情况下依旧可以演示完整的交互；切换为 `false` 后，会将请求发送给 `@aster/client-js`，并更新连接状态提示。

### 常用配置项

| 字段 | 说明 |
| ---- | ---- |
| `demoMode` | 是否启用内置 mock（演示用）。 |
| `agentProfile` | Hero/Playground 中展示的 Agent 名称、描述与头像。 |
| `enableImage` / `enableVoice` | 控制底部输入区的拓展能力。 |
| `onApproveAction` / `onRejectAction` | 接入人工审批流程，配合 `ThinkingBlock` 组件展示工具调用细节。 |

更多字段请参考 `src/types/chat.ts`。

## 体验站模块

1. **Hero**：指标、亮点与实时 AsterChat 预览。
2. **Capability Spectrum**：参考 ChatUI 的信息结构展示产品能力。
3. **Playground**：HTTP / Streaming 双模式，可切换 demo 配置。
4. **Builder Stories**：按步骤解释如何在业务中落地。
5. **Documentation & Assets**：链接到安装、API、主题定制等文档。

以上模块均在 `App.vue` 中使用纯数据驱动，方便按业务场景定制文案或替换链接。

## 连接真实 Aster Server

1. 启动后端：`go run ./cmd/aster-server`.
2. 编辑 `App.vue` 中 `demoModes` 或在业务页面中传入 `demoMode: false`。
3. 配置 `apiUrl` / `wsUrl` / `apiKey` 即可完成连通。

`useAsterClient` 已封装 HTTP + WebSocket（当前 WS 仍为 TODO，接口已预留），`useChat` 则负责消息管理、mock 模式以及 Loading/思考态的处理。

## 主题与风格

- Tailwind 用于原子化样式，`tailwind.config.js` 中扩展了 `primary/surface/background` 等语义色。
- 全局字体统一使用 `Inter`，并提供若干渐变背景、发光效果以匹配 ChatUI 的视觉风格。
- `src/style.css` 中包含滚动条、Markdown 渲染、动画等通用样式，可按品牌需要调整。

## 贡献

欢迎在 `ui/` 目录继续扩展组件或改进站点布局。提交 PR 前请运行：

```bash
npm run build
```

## 许可证

MIT License © Aster Cloud
