<template>
  <div class="todo-tool">
    <!-- 头部工具栏 -->
    <div class="todo-header">
      <div class="header-title">
        <Icon type="list" size="sm" />
        <span>任务管理</span>
      </div>
      <div class="header-actions">
        <button
          class="action-button"
          title="添加任务"
          @click="showAddForm = !showAddForm"
        >
          <Icon type="plus" size="sm" />
        </button>
        <button
          class="action-button"
          title="刷新任务"
          @click="refreshTodos"
        >
          <Icon type="refresh" size="sm" />
        </button>
        <button
          class="action-button"
          title="切换视图"
          @click="toggleViewMode"
        >
          <Icon :type="viewMode === 'list' ? 'grid' : 'list'" size="sm" />
        </button>
      </div>
    </div>

    <!-- 添加任务表单 -->
    <div v-if="showAddForm" class="add-form">
      <div class="form-content">
        <input
          v-model="newTodo.content"
          ref="newTodoInput"
          type="text"
          placeholder="输入任务内容..."
          class="todo-input"
          @keydown.enter="addTodo"
          @keydown.esc="showAddForm = false"
        />
        <div class="form-actions">
          <select v-model="newTodo.priority" class="priority-select">
            <option value="">优先级</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          <input
            v-model="newTodo.dueDate"
            type="date"
            class="date-input"
            title="截止日期"
          />
          <button
            class="add-button"
            :disabled="!newTodo.content.trim()"
            @click="addTodo"
          >
            添加
          </button>
          <button
            class="cancel-button"
            @click="showAddForm = false; newTodo.content = ''"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="todo-filters">
      <button
        v-for="filter in filters"
        :key="filter.key"
        :class="['filter-button', { active: currentFilter === filter.key }]"
        @click="currentFilter = filter.key"
      >
        <Icon :type="filter.icon" size="sm" />
        {{ filter.label }}
        <span class="filter-count">{{ filter.count }}</span>
      </button>
    </div>

    <!-- 任务列表 -->
    <div class="todo-list">
      <div
        v-for="todo in filteredTodos"
        :key="todo.id"
        :class="['todo-item', {
          'todo-completed': todo.completed,
          'todo-priority-high': todo.priority === 'high',
          'todo-priority-medium': todo.priority === 'medium',
          'todo-priority-low': todo.priority === 'low'
        }]"
      >
        <div class="todo-main">
          <div class="todo-checkbox">
            <input
              :id="`todo-${todo.id}`"
              v-model="todo.completed"
              type="checkbox"
              @change="updateTodo(todo)"
            />
          </div>

          <div class="todo-content">
            <div class="todo-text">
              <span v-if="todo.completed" class="completed-text">{{ todo.content }}</span>
              <span v-else>{{ todo.content }}</span>
            </div>

            <div class="todo-meta">
              <span v-if="todo.priority" :class="`priority-badge priority-${todo.priority}`">
                {{ getPriorityText(todo.priority) }}
              </span>
              <span v-if="todo.dueDate" class="due-date" :class="{ 'overdue': isOverdue(todo.dueDate) }">
                <Icon type="calendar" size="xs" />
                {{ formatDate(todo.dueDate) }}
              </span>
              <span class="created-date">
                创建于 {{ formatDateTime(todo.createdAt) }}
              </span>
            </div>
          </div>
        </div>

        <div class="todo-actions">
          <button
            class="action-btn edit-btn"
            title="编辑任务"
            @click="editTodo(todo)"
          >
            <Icon type="edit" size="xs" />
          </button>
          <button
            class="action-btn delete-btn"
            title="删除任务"
            @click="deleteTodo(todo.id)"
          >
            <Icon type="trash" size="xs" />
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredTodos.length === 0" class="empty-state">
        <Icon type="inbox" size="lg" />
        <p>{{ getEmptyMessage() }}</p>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="todo-stats">
      <div class="stat-item">
        <span class="stat-value">{{ todos.length }}</span>
        <span class="stat-label">总计</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ completedCount }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ activeCount }}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ overdueCount }}</span>
        <span class="stat-label">已逾期</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import Icon from '../ChatUI/Icon.vue';

interface Todo {
  id: string;
  content: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | '';
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  wsUrl?: string;
  sessionId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  wsUrl: 'ws://localhost:8080/ws',
  sessionId: 'default',
});

const emit = defineEmits<{
  todoCreated: [todo: Todo];
  todoUpdated: [todo: Todo];
  todoDeleted: [id: string];
}>();

// 响应式数据
const todos = ref<Todo[]>([]);
const showAddForm = ref(false);
const currentFilter = ref('all');
const viewMode = ref<'list' | 'grid'>('list');
const newTodoInput = ref<HTMLInputElement>();
const websocket = ref<WebSocket | null>(null);

const newTodo = ref({
  content: '',
  priority: '' as 'low' | 'medium' | 'high' | '',
  dueDate: '',
});

// 过滤器选项
const filters = computed(() => [
  { key: 'all', label: '全部', icon: 'list', count: todos.value.length },
  { key: 'active', label: '进行中', icon: 'play', count: todos.value.filter(t => !t.completed).length },
  { key: 'completed', label: '已完成', icon: 'check', count: todos.value.filter(t => t.completed).length },
  { key: 'overdue', label: '已逾期', icon: 'alert', count: overdueCount.value },
]);

// 计算属性
const filteredTodos = computed(() => {
  let filtered = todos.value;

  switch (currentFilter.value) {
    case 'active':
      filtered = filtered.filter(t => !t.completed);
      break;
    case 'completed':
      filtered = filtered.filter(t => t.completed);
      break;
    case 'overdue':
      filtered = filtered.filter(t => !t.completed && t.dueDate && isOverdue(t.dueDate));
      break;
  }

  return filtered.sort((a, b) => {
    // 优先级排序
    const priorityOrder = { high: 0, medium: 1, low: 2, '': 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    // 日期排序
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const completedCount = computed(() => todos.value.filter(t => t.completed).length);
const activeCount = computed(() => todos.value.filter(t => !t.completed).length);
const overdueCount = computed(() =>
  todos.value.filter(t => !t.completed && t.dueDate && isOverdue(t.dueDate)).length
);

// WebSocket 连接
const connectWebSocket = () => {
  try {
    websocket.value = new WebSocket(`${props.wsUrl}?session=${props.sessionId}`);

    websocket.value.onopen = () => {
      console.log('TodoTool WebSocket connected');
      requestTodos();
    };

    websocket.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    websocket.value.onclose = () => {
      console.log('TodoTool WebSocket disconnected');
      // 5秒后重连
      setTimeout(connectWebSocket, 5000);
    };

    websocket.value.onerror = (error) => {
      console.error('TodoTool WebSocket error:', error);
    };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
  }
};

const handleWebSocketMessage = (message: any) => {
  switch (message.type) {
    case 'todo_list_response':
      todos.value = message.todos || [];
      break;
    case 'todo_created':
      const newTodoFromServer = message.todo;
      const existingIndex = todos.value.findIndex(t => t.id === newTodoFromServer.id);
      if (existingIndex === -1) {
        todos.value.push(newTodoFromServer);
      }
      emit('todoCreated', newTodoFromServer);
      break;
    case 'todo_updated':
      const updatedTodo = message.todo;
      const index = todos.value.findIndex(t => t.id === updatedTodo.id);
      if (index !== -1) {
        todos.value[index] = updatedTodo;
      }
      emit('todoUpdated', updatedTodo);
      break;
    case 'todo_deleted':
      const deletedId = message.id;
      todos.value = todos.value.filter(t => t.id !== deletedId);
      emit('todoDeleted', deletedId);
      break;
  }
};

const sendWebSocketMessage = (message: any) => {
  if (websocket.value && websocket.value.readyState === WebSocket.OPEN) {
    websocket.value.send(JSON.stringify(message));
  }
};

// 任务操作方法
const requestTodos = () => {
  sendWebSocketMessage({ type: 'todo_list_request' });
};

const addTodo = () => {
  if (!newTodo.value.content.trim()) return;

  const todo: Partial<Todo> = {
    content: newTodo.value.content.trim(),
    priority: newTodo.value.priority,
    dueDate: newTodo.value.dueDate,
  };

  sendWebSocketMessage({
    type: 'todo_create',
    todo,
  });

  // 重置表单
  newTodo.value = { content: '', priority: '', dueDate: '' };
  showAddForm.value = false;
};

const updateTodo = (todo: Todo) => {
  sendWebSocketMessage({
    type: 'todo_update',
    todo: {
      ...todo,
      updatedAt: new Date().toISOString(),
    },
  });
};

const deleteTodo = (id: string) => {
  if (confirm('确定要删除这个任务吗？')) {
    sendWebSocketMessage({
      type: 'todo_delete',
      id,
    });
  }
};

const editTodo = (todo: Todo) => {
  const newContent = prompt('编辑任务内容:', todo.content);
  if (newContent && newContent.trim() !== todo.content) {
    updateTodo({
      ...todo,
      content: newContent.trim(),
      updatedAt: new Date().toISOString(),
    });
  }
};

const refreshTodos = () => {
  requestTodos();
};

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'list' ? 'grid' : 'list';
};

// 工具方法
const getPriorityText = (priority: string) => {
  const map = { high: '高', medium: '中', low: '低' };
  return map[priority as keyof typeof map] || '';
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const isOverdue = (dateString: string) => {
  return new Date(dateString) < new Date(new Date().toDateString());
};

const getEmptyMessage = () => {
  const messages = {
    all: '暂无任务，点击 + 添加第一个任务',
    active: '暂无进行中的任务',
    completed: '暂无已完成的任务',
    overdue: '暂无逾期的任务',
  };
  return messages[currentFilter.value as keyof typeof messages];
};

// 生命周期
onMounted(() => {
  connectWebSocket();

  // 自动聚焦到添加输入框
  watch(showAddForm, (show) => {
    if (show) {
      nextTick(() => {
        newTodoInput.value?.focus();
      });
    }
  });
});

// 组件卸载时关闭 WebSocket连接
</script>

<style scoped>
.todo-tool {
  @apply flex flex-col h-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg;
  max-height: 600px;
}

.todo-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark;
}

.header-title {
  @apply flex items-center gap-2 font-semibold text-text dark:text-text-dark;
}

.header-actions {
  @apply flex gap-1;
}

.action-button {
  @apply p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors;
}

.add-form {
  @apply px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-border dark:border-border-dark;
}

.form-content {
  @apply space-y-2;
}

.todo-input {
  @apply w-full px-3 py-2 border border-border dark:border-border-dark rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white;
}

.form-actions {
  @apply flex gap-2 items-center;
}

.priority-select, .date-input {
  @apply px-2 py-1 text-sm border border-border dark:border-border-dark rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white;
}

.add-button {
  @apply px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.cancel-button {
  @apply px-3 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm rounded transition-colors;
}

.todo-filters {
  @apply flex gap-1 px-4 py-2 border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark;
}

.filter-button {
  @apply flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors;
}

.filter-button.active {
  @apply bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300;
}

.filter-count {
  @apply text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full;
}

.todo-list {
  @apply flex-1 overflow-y-auto px-4 py-2 space-y-1;
}

.todo-item {
  @apply flex items-center gap-3 p-3 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors;
}

.todo-completed {
  @apply opacity-60;
}

.todo-completed .todo-text {
  @apply line-through;
}

.todo-priority-high {
  @apply border-l-4 border-l-red-500;
}

.todo-priority-medium {
  @apply border-l-4 border-l-yellow-500;
}

.todo-priority-low {
  @apply border-l-4 border-l-green-500;
}

.todo-main {
  @apply flex items-center gap-3 flex-1 min-w-0;
}

.todo-checkbox {
  @apply flex-shrink-0;
}

.todo-content {
  @apply flex-1 min-w-0;
}

.todo-text {
  @apply text-sm text-text dark:text-text-dark break-words;
}

.completed-text {
  @apply text-gray-500 dark:text-gray-400;
}

.todo-meta {
  @apply flex items-center gap-2 mt-1;
}

.priority-badge {
  @apply text-xs px-1.5 py-0.5 rounded font-medium;
}

.priority-high {
  @apply bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300;
}

.priority-medium {
  @apply bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300;
}

.priority-low {
  @apply bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300;
}

.due-date {
  @apply flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400;
}

.due-date.overdue {
  @apply text-red-500 dark:text-red-400;
}

.created-date {
  @apply text-xs text-gray-400 dark:text-gray-500;
}

.todo-actions {
  @apply flex gap-1 opacity-0 hover:opacity-100 transition-opacity;
}

.todo-item:hover .todo-actions {
  @apply opacity-100;
}

.action-btn {
  @apply p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors;
}

.delete-btn:hover {
  @apply text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500;
}

.todo-stats {
  @apply flex items-center justify-around px-4 py-3 border-t border-border dark:border-border-dark bg-surface dark:bg-surface-dark;
}

.stat-item {
  @apply text-center;
}

.stat-value {
  @apply block text-lg font-semibold text-text dark:text-text-dark;
}

.stat-label {
  @apply block text-xs text-gray-500 dark:text-gray-400;
}
</style>