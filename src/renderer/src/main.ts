import { createApp } from 'vue'
import ElementPlusX from 'vue-element-plus-x'
import { createPinia } from 'pinia'
import App from './App.vue'

console.time('[启动耗时] 渲染进程 bootstrap')
const app = createApp(App)
app.use(ElementPlusX)
app.use(createPinia())
app.mount('#app')
console.timeEnd('[启动耗时] 渲染进程 bootstrap')

const style = document.createElement('style')
style.textContent = `
  :root {
    --el-color-primary: #FF8C00;
    --el-color-primary-light-3: #FFB85C;
    --el-color-primary-light-5: #FFD19C;
    --el-color-primary-light-7: #FFE8CC;
    --el-color-primary-light-8: #FFF2E0;
    --el-color-primary-light-9: #FFF9F2;
    --el-color-primary-dark-2: #E07800;
  }
  #app-root {
    height: 100vh;
    overflow: hidden;
  }
`
document.head.appendChild(style)
