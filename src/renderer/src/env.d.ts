/// <reference types="vite/client" />

/** 声明 .vue 单文件组件模块 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
