import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import App from './App.vue'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const app = createApp(App)
app.component('v-chart', ECharts)
app.use(ElementPlus, { locale: zhCn })
app.use(createPinia())
app.mount('#app')

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
