import { createApp } from 'vue';
import router from './router';
import App from './AppRoot.vue';
import './style.css';

// 启用暗色模式
document.documentElement.classList.add('dark');

const app = createApp(App);
app.use(router);
app.mount('#app');
