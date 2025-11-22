import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// 启用暗色模式
document.documentElement.classList.add('dark');

const app = createApp(App);

app.mount('#app');
