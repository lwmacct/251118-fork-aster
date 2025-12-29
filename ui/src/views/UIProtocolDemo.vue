<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
    <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Aster UI Protocol E2E 测试
      </h1>

      <!-- 控制面板 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">测试控制</h2>
        <div class="flex flex-wrap gap-4">
          <button
            @click="runBasicTest"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            基础组件测试
          </button>
          <button
            @click="runDataBindingTest"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            数据绑定测试
          </button>
          <button
            @click="runStreamingTest"
            class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            流式渲染测试
          </button>
          <button
            @click="runFormTest"
            class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            表单组件测试
          </button>
          <button
            @click="clearSurface"
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            清除 Surface
          </button>
        </div>
      </div>

      <!-- 测试结果区域 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Surface 渲染区域 -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Surface 渲染结果
          </h2>
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-h-[300px]">
            <AsterSurface
              :surface-id="surfaceId"
              :processor="processor"
              @action="handleAction"
              @surface-update="handleSurfaceUpdate"
            />
          </div>
        </div>

        <!-- 事件日志 -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            事件日志
          </h2>
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
            <div v-for="(log, index) in eventLogs" :key="index" class="mb-2 text-sm">
              <span class="text-gray-500 dark:text-gray-400">{{ log.time }}</span>
              <span :class="getLogColor(log.type)" class="ml-2 font-medium">{{ log.type }}</span>
              <pre class="text-gray-700 dark:text-gray-300 mt-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">{{ JSON.stringify(log.data, null, 2) }}</pre>
            </div>
            <div v-if="eventLogs.length === 0" class="text-gray-400 dark:text-gray-500">
              暂无事件
            </div>
          </div>
        </div>
      </div>

      <!-- 数据模型状态 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          数据模型状态
        </h2>
        <pre class="text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded overflow-x-auto text-gray-700 dark:text-gray-300">{{ JSON.stringify(currentDataModel, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { MessageProcessor, createMessageProcessor } from '@/protocol/message-processor'
import { createStandardRegistry } from '@/protocol/standard-components'
import AsterSurface from '@/components/protocol/AsterSurface.vue'
import type { UIActionEvent, Surface } from '@/types/ui-protocol'

const surfaceId = 'e2e-test-surface'
const registry = createStandardRegistry()
const processor = createMessageProcessor(registry)

interface EventLog {
  time: string
  type: string
  data: unknown
}

const eventLogs = ref<EventLog[]>([])
const currentDataModel = ref<Record<string, unknown>>({})

function addLog(type: string, data: unknown) {
  const now = new Date()
  eventLogs.value.unshift({
    time: now.toLocaleTimeString(),
    type,
    data,
  })
  if (eventLogs.value.length > 50) {
    eventLogs.value.pop()
  }
}

function getLogColor(type: string): string {
  switch (type) {
    case 'ACTION': return 'text-blue-500'
    case 'UPDATE': return 'text-green-500'
    case 'ERROR': return 'text-red-500'
    default: return 'text-gray-500'
  }
}

function handleAction(event: UIActionEvent) {
  addLog('ACTION', event)
  console.log('UI Action:', event)
}

function handleSurfaceUpdate(surface: Surface) {
  addLog('UPDATE', { rootId: surface.rootComponentId, componentCount: surface.components.size })
  currentDataModel.value = surface.dataModel
}

// 基础组件测试
function runBasicTest() {
  addLog('TEST', { name: '基础组件测试' })
  
  processor.processMessage({
    surfaceUpdate: {
      surfaceId,
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: { explicitList: ['header', 'content', 'footer'] },
              gap: 16,
            },
          },
        },
        {
          id: 'header',
          component: {
            Text: {
              text: { literalString: '🎉 Aster UI Protocol 测试' },
              usageHint: 'h1',
            },
          },
        },
        {
          id: 'content',
          component: {
            Card: {
              title: { literalString: '欢迎使用 Aster UI' },
              subtitle: { literalString: '这是一个声明式 UI 协议演示' },
              children: { explicitList: ['card-content'] },
            },
          },
        },
        {
          id: 'card-content',
          component: {
            Column: {
              children: { explicitList: ['desc', 'buttons'] },
              gap: 12,
            },
          },
        },
        {
          id: 'desc',
          component: {
            Text: {
              text: { literalString: 'Aster UI Protocol 让 AI Agent 能够安全地生成和更新富交互界面。' },
              usageHint: 'body',
            },
          },
        },
        {
          id: 'buttons',
          component: {
            Row: {
              children: { explicitList: ['btn1', 'btn2'] },
              gap: 8,
            },
          },
        },
        {
          id: 'btn1',
          component: {
            Button: {
              label: { literalString: '主要按钮' },
              action: 'primary-click',
              variant: 'primary',
            },
          },
        },
        {
          id: 'btn2',
          component: {
            Button: {
              label: { literalString: '次要按钮' },
              action: 'secondary-click',
              variant: 'secondary',
            },
          },
        },
        {
          id: 'footer',
          component: {
            Divider: { orientation: 'horizontal' },
          },
        },
      ],
    },
  })

  processor.processMessage({
    beginRendering: { surfaceId, root: 'root' },
  })
}

// 数据绑定测试
function runDataBindingTest() {
  addLog('TEST', { name: '数据绑定测试' })

  // 先设置数据模型
  processor.processMessage({
    dataModelUpdate: {
      surfaceId,
      path: '/',
      contents: {
        user: {
          name: 'Alice',
          email: 'alice@example.com',
        },
        counter: 0,
        items: ['苹果', '香蕉', '橙子'],
      },
    },
  })

  processor.processMessage({
    surfaceUpdate: {
      surfaceId,
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: { explicitList: ['title', 'user-card', 'counter-section', 'list-section'] },
              gap: 16,
            },
          },
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '📊 数据绑定演示' },
              usageHint: 'h2',
            },
          },
        },
        {
          id: 'user-card',
          component: {
            Card: {
              title: { path: '/user/name' },
              subtitle: { path: '/user/email' },
              children: { explicitList: [] },
            },
          },
        },
        {
          id: 'counter-section',
          component: {
            Row: {
              children: { explicitList: ['counter-label', 'counter-btn'] },
              gap: 8,
              align: 'center',
            },
          },
        },
        {
          id: 'counter-label',
          component: {
            Text: {
              text: { path: '/counter' },
              usageHint: 'h3',
            },
          },
        },
        {
          id: 'counter-btn',
          component: {
            Button: {
              label: { literalString: '增加计数' },
              action: 'increment',
              variant: 'primary',
            },
          },
        },
        {
          id: 'list-section',
          component: {
            List: {
              children: {
                template: {
                  componentId: 'list-item-template',
                  dataBinding: '/items',
                },
              },
              dividers: true,
            },
          },
        },
        {
          id: 'list-item-template',
          component: {
            Text: {
              text: { path: '' },
              usageHint: 'body',
            },
          },
        },
      ],
    },
  })

  processor.processMessage({
    beginRendering: { surfaceId, root: 'root' },
  })
}

// 流式渲染测试
function runStreamingTest() {
  addLog('TEST', { name: '流式渲染测试' })

  // 先开始渲染（组件还未定义）
  processor.processMessage({
    beginRendering: { surfaceId, root: 'stream-root' },
  })

  // 模拟流式添加组件
  setTimeout(() => {
    processor.processMessage({
      surfaceUpdate: {
        surfaceId,
        components: [
          {
            id: 'stream-root',
            component: {
              Column: {
                children: { explicitList: ['stream-title', 'stream-content'] },
                gap: 12,
              },
            },
          },
          {
            id: 'stream-title',
            component: {
              Text: {
                text: { literalString: '⏳ 流式渲染中...' },
                usageHint: 'h2',
              },
            },
          },
        ],
      },
    })
    addLog('STREAM', { step: 1, message: '添加标题组件' })
  }, 500)

  setTimeout(() => {
    processor.processMessage({
      surfaceUpdate: {
        surfaceId,
        components: [
          {
            id: 'stream-content',
            component: {
              Card: {
                title: { literalString: '内容加载完成' },
                children: { explicitList: ['stream-text'] },
              },
            },
          },
        ],
      },
    })
    addLog('STREAM', { step: 2, message: '添加卡片组件' })
  }, 1000)

  setTimeout(() => {
    processor.processMessage({
      surfaceUpdate: {
        surfaceId,
        components: [
          {
            id: 'stream-text',
            component: {
              Text: {
                text: { literalString: '✅ 所有组件已加载完成！流式渲染支持在组件定义完成前开始渲染。' },
                usageHint: 'body',
              },
            },
          },
          {
            id: 'stream-title',
            component: {
              Text: {
                text: { literalString: '✨ 流式渲染完成' },
                usageHint: 'h2',
              },
            },
          },
        ],
      },
    })
    addLog('STREAM', { step: 3, message: '流式渲染完成' })
  }, 1500)
}

// 表单组件测试
function runFormTest() {
  addLog('TEST', { name: '表单组件测试' })

  processor.processMessage({
    dataModelUpdate: {
      surfaceId,
      path: '/',
      contents: {
        form: {
          name: '',
          email: '',
          agree: false,
          country: 'cn',
          rating: 50,
        },
        countries: [
          { value: 'cn', label: '中国' },
          { value: 'us', label: '美国' },
          { value: 'jp', label: '日本' },
        ],
      },
    },
  })

  processor.processMessage({
    surfaceUpdate: {
      surfaceId,
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: { explicitList: ['form-title', 'form-card'] },
              gap: 16,
            },
          },
        },
        {
          id: 'form-title',
          component: {
            Text: {
              text: { literalString: '📝 表单组件测试' },
              usageHint: 'h2',
            },
          },
        },
        {
          id: 'form-card',
          component: {
            Card: {
              title: { literalString: '用户注册' },
              children: { explicitList: ['form-fields'] },
            },
          },
        },
        {
          id: 'form-fields',
          component: {
            Column: {
              children: { explicitList: ['name-field', 'email-field', 'country-field', 'rating-field', 'agree-field', 'submit-btn'] },
              gap: 16,
            },
          },
        },
        {
          id: 'name-field',
          component: {
            TextField: {
              value: { path: '/form/name' },
              label: { literalString: '姓名' },
              placeholder: { literalString: '请输入您的姓名' },
            },
          },
        },
        {
          id: 'email-field',
          component: {
            TextField: {
              value: { path: '/form/email' },
              label: { literalString: '邮箱' },
              placeholder: { literalString: '请输入您的邮箱' },
            },
          },
        },
        {
          id: 'country-field',
          component: {
            Select: {
              value: { path: '/form/country' },
              options: { path: '/countries' },
              label: { literalString: '国家' },
            },
          },
        },
        {
          id: 'rating-field',
          component: {
            Slider: {
              value: { path: '/form/rating' },
              label: { literalString: '满意度' },
              min: 0,
              max: 100,
              step: 10,
            },
          },
        },
        {
          id: 'agree-field',
          component: {
            Checkbox: {
              checked: { path: '/form/agree' },
              label: { literalString: '我同意服务条款' },
            },
          },
        },
        {
          id: 'submit-btn',
          component: {
            Button: {
              label: { literalString: '提交' },
              action: 'submit-form',
              variant: 'primary',
            },
          },
        },
      ],
    },
  })

  processor.processMessage({
    beginRendering: { surfaceId, root: 'root' },
  })
}

// 清除 Surface
function clearSurface() {
  processor.processMessage({
    deleteSurface: { surfaceId },
  })
  addLog('DELETE', { surfaceId })
  currentDataModel.value = {}
}
</script>
