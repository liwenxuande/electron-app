import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)    // Element Plus 全局注册
app.use(createPinia())  // Pinia 状态管理
app.mount('#app')
