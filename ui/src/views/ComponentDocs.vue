<template>
  <div class="component-docs">
    <!-- 顶部导航 -->
    <Navbar title="ChatUI 组件文档">
      <template #menu>
        <Search
          v-model="searchQuery"
          placeholder="搜索组件..."
          @search="handleSearch"
        />
      </template>
      <template #actions>
        <Button variant="text" icon="github">GitHub</Button>
      </template>
    </Navbar>

    <div class="docs-container">
      <!-- 左侧导航 -->
      <Sidebar title="组件" :collapsible="false" class="docs-sidebar">
        <div class="component-nav">
          <div
            v-for="category in categories"
            :key="category.name"
            class="nav-category"
          >
            <div class="category-title">{{ category.name }}</div>
            <div
              v-for="comp in category.components"
              :key="comp.key"
              :class="['nav-item', { active: currentComponent === comp.key }]"
              @click="selectComponent(comp.key)"
            >
              {{ comp.name }}
            </div>
          </div>
        </div>
      </Sidebar>

      <!-- 主内容区域 -->
      <div class="docs-main">
        <ScrollView>
          <div class="docs-content">
            <!-- Button 文档 -->
            <DocViewer
              v-if="currentComponent === 'button'"
              :content="buttonDoc"
              :code="buttonCode"
            >
              <template #demo>
                <DemoSection title="基础用法">
                  <Button>默认按钮</Button>
                </DemoSection>
                
                <DemoSection title="按钮类型">
                  <Flex gap="md">
                    <Button variant="primary">主要按钮</Button>
                    <Button variant="secondary">次要按钮</Button>
                    <Button variant="text">文本按钮</Button>
                  </Flex>
                </DemoSection>
                
                <DemoSection title="按钮尺寸">
                  <Flex gap="md" align="center">
                    <Button size="sm">小按钮</Button>
                    <Button size="md">中按钮</Button>
                    <Button size="lg">大按钮</Button>
                  </Flex>
                </DemoSection>
                
                <DemoSection title="带图标">
                  <Flex gap="md">
                    <Button icon="send">发送</Button>
                    <Button icon="image" variant="secondary">图片</Button>
                  </Flex>
                </DemoSection>
              </template>
            </DocViewer>

            <!-- Bubble 文档 -->
            <DocViewer
              v-else-if="currentComponent === 'bubble'"
              :content="bubbleDoc"
              :code="bubbleCode"
            >
              <template #demo>
                <DemoSection title="基础用法">
                  <Flex direction="column" gap="md">
                    <Bubble content="你好！" position="left" />
                    <Bubble content="很高兴认识你" position="right" />
                  </Flex>
                </DemoSection>
                
                <DemoSection title="消息状态">
                  <Flex direction="column" gap="md">
                    <Bubble content="发送中..." position="right" status="pending" />
                    <Bubble content="已发送" position="right" status="sent" />
                    <Bubble content="发送失败" position="right" status="error" />
                  </Flex>
                </DemoSection>
                
                <DemoSection title="Markdown 支持">
                  <Bubble 
                    content="这是 **粗体** 和 *斜体* 文本，还有 `代码`"
                    position="left"
                  />
                </DemoSection>
              </template>
            </DocViewer>

            <!-- Avatar 文档 -->
            <DocViewer
              v-else-if="currentComponent === 'avatar'"
              :content="avatarDoc"
              :code="avatarCode"
            >
              <template #demo>
                <DemoSection title="不同尺寸">
                  <Flex gap="md" align="center">
                    <Avatar alt="U" size="xs" />
                    <Avatar alt="S" size="sm" />
                    <Avatar alt="M" size="md" />
                    <Avatar alt="L" size="lg" />
                    <Avatar alt="X" size="xl" />
                  </Flex>
                </DemoSection>
                
                <DemoSection title="状态指示">
                  <Flex gap="md" align="center">
                    <Avatar alt="在线" size="md" status="online" />
                    <Avatar alt="忙碌" size="md" status="busy" />
                    <Avatar alt="离线" size="md" status="offline" />
                  </Flex>
                </DemoSection>
              </template>
            </DocViewer>

            <!-- 默认页面 -->
            <div v-else class="welcome-page">
              <h1 class="welcome-title">ChatUI 组件文档</h1>
              <p class="welcome-subtitle">
                选择左侧组件查看详细文档和实时演示
              </p>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">33+</div>
                  <div class="stat-label">组件总数</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">100%</div>
                  <div class="stat-label">TypeScript</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">Vue 3</div>
                  <div class="stat-label">框架</div>
                </div>
              </div>
            </div>
          </div>
        </ScrollView>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Navbar, Sidebar, ScrollView, Search, Button, Flex,
  Bubble, Avatar
} from '@/components/ChatUI';
import DocViewer from '@/components/DocViewer.vue';
import DemoSection from '@/components/DemoSection.vue';

// 导入文档内容
import buttonDoc from '@/docs/components/Button.md?raw';
import bubbleDoc from '@/docs/components/Bubble.md?raw';
import avatarDoc from '@/docs/components/Avatar.md?raw';

const searchQuery = ref('');
const currentComponent = ref('');

const categories = [
  {
    name: '对话组件',
    components: [
      { key: 'chat', name: 'Chat 聊天容器' },
      { key: 'bubble', name: 'Bubble 消息气泡' },
      { key: 'think-bubble', name: 'ThinkBubble 思考气泡' },
      { key: 'card', name: 'Card 卡片' },
    ],
  },
  {
    name: '基础组件',
    components: [
      { key: 'button', name: 'Button 按钮' },
      { key: 'icon', name: 'Icon 图标' },
      { key: 'avatar', name: 'Avatar 头像' },
      { key: 'image', name: 'Image 图片' },
    ],
  },
  {
    name: '表单组件',
    components: [
      { key: 'input', name: 'Input 输入框' },
      { key: 'search', name: 'Search 搜索框' },
      { key: 'checkbox', name: 'Checkbox 复选框' },
      { key: 'radio', name: 'Radio 单选框' },
    ],
  },
];

const selectComponent = (key: string) => {
  currentComponent.value = key;
};

const handleSearch = (query: string) => {
  console.log('Search:', query);
};

// 示例代码
const buttonCode = `<template>
  <Button variant="primary">主要按钮</Button>
</template>

<script setup>
import { Button } from '@/components/ChatUI';
<\/script>`;

const bubbleCode = `<template>
  <Bubble content="你好！" position="left" />
</template>

<script setup>
import { Bubble } from '@/components/ChatUI';
<\/script>`;

const avatarCode = `<template>
  <Avatar alt="User" size="md" status="online" />
</template>

<script setup>
import { Avatar } from '@/components/ChatUI';
<\/script>`;
</script>

<style scoped>
.component-docs {
  @apply min-h-screen bg-gray-50 dark:bg-gray-900;
}

.docs-container {
  @apply flex h-[calc(100vh-64px)];
}

.docs-sidebar {
  @apply w-64;
}

.component-nav {
  @apply space-y-6;
}

.nav-category {
  @apply space-y-1;
}

.category-title {
  @apply text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2;
}

.nav-item {
  @apply px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors;
}

.nav-item.active {
  @apply bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium;
}

.docs-main {
  @apply flex-1 overflow-hidden;
}

.docs-content {
  @apply p-8;
}

.welcome-page {
  @apply text-center py-20;
}

.welcome-title {
  @apply text-4xl font-bold text-gray-900 dark:text-white mb-4;
}

.welcome-subtitle {
  @apply text-lg text-gray-600 dark:text-gray-400 mb-12;
}

.stats-grid {
  @apply grid grid-cols-3 gap-6 max-w-2xl mx-auto;
}

.stat-card {
  @apply bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700;
}

.stat-value {
  @apply text-3xl font-bold text-gray-900 dark:text-white mb-2;
}

.stat-label {
  @apply text-sm text-gray-600 dark:text-gray-400;
}
</style>
