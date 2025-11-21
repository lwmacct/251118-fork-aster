<template>
  <div id="app" class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-lg p-8 text-center mb-6">
        <h1 class="text-5xl font-bold text-gray-900 mb-4">🚀 AsterUI</h1>
        <p class="text-xl text-gray-600 mb-4">Universal AI Agent Interface</p>
        <div class="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
          ✅ Vue 应用运行成功！
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-lg shadow p-6 text-center">
          <div class="text-4xl font-bold mb-2" :style="{ color: stat.color }">{{ stat.value }}</div>
          <div class="text-sm text-gray-600">{{ stat.label }}</div>
        </div>
      </div>

      <!-- Links -->
      <div class="bg-white rounded-lg shadow-lg p-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">🔗 快速链接</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a v-for="link in links" :key="link.title" 
             :href="link.url" 
             :class="['block p-4 rounded-lg transition-colors', link.bgClass]">
            <div :class="['font-semibold mb-1', link.textClass]">{{ link.title }}</div>
            <div class="text-sm text-gray-600">{{ link.desc }}</div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const stats = ref([
  { value: '20', label: '组件', color: '#3b82f6' },
  { value: '11', label: 'Composables', color: '#8b5cf6' },
  { value: '15', label: '文档', color: '#10b981' },
  { value: '6', label: '示例', color: '#f59e0b' },
  { value: '90%', label: '完成度', color: '#ef4444' }
]);

const links = ref([
  { 
    title: '📺 完整演示', 
    desc: '查看所有功能演示', 
    url: '/demo.html',
    bgClass: 'bg-blue-50 hover:bg-blue-100',
    textClass: 'text-blue-900'
  },
  { 
    title: '🧪 组件测试', 
    desc: '测试所有组件功能', 
    url: '/test-components.html',
    bgClass: 'bg-purple-50 hover:bg-purple-100',
    textClass: 'text-purple-900'
  },
  { 
    title: '💬 基础聊天', 
    desc: '简单的聊天示例', 
    url: '/examples/basic-chat.html',
    bgClass: 'bg-green-50 hover:bg-green-100',
    textClass: 'text-green-900'
  },
  { 
    title: '🎯 完整集成', 
    desc: '所有功能集成示例', 
    url: '/examples/complete-demo.html',
    bgClass: 'bg-orange-50 hover:bg-orange-100',
    textClass: 'text-orange-900'
  }
]);

console.log('✅ AsterUI App loaded successfully!');
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
