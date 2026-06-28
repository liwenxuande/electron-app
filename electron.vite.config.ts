import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  // 主进程配置 —— 必须保留 externalizeDepsPlugin 处理 Electron CJS→ESM 互操作
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  // 预加载脚本配置
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  // 渲染进程配置
  renderer: {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src')
      }
    }
  }
})
