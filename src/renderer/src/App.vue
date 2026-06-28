<template>
  <div id="app-root">
    <UserList />
  </div>
</template>

<script setup lang="ts">
import UserList from './views/UserList.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background-color: #f5f7fa;
}

#app-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
