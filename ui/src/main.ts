import { createApp } from 'vue';
import router from './router';
import App from './AppRoot.vue';
import './style.css';

const app = createApp(App);
app.use(router);
app.mount('#app');
