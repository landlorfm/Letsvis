<template>
  <div id="app">
    <nav class="view-navigation">
      <router-link to="/lmem" class="nav-link" :class="{ active: $route.name === 'lmem' }">
        LMEM 可视化
      </router-link>
      <router-link to="/timestep" class="nav-link" :class="{ active: $route.name === 'timestep' }">
        Timestep 可视化
      </router-link>
    </nav>
    
    <main class="main-content">
      <router-view />
    </main>
    <!-- <main class="main-content">
      <div v-if="!isMounted" class="loading">应用加载中...</div>
      <div v-else-if="$route.matched.length === 0" class="error">
        未找到路由匹配！当前路径: {{ $route.path }}
      </div>
      <router-view v-else />
    </main> -->
  </div>
</template>

<script setup>
// 不需要直接导入视图组件，路由会自动处理
</script>

<style scoped>
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.view-navigation {
  background-color: #2c3e50;
  padding: 1rem;
  display: flex;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-link {
  color: #ecf0f1;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.nav-link:hover {
  background-color: #34495e;
}

.nav-link.active {
  background-color: #3498db;
  font-weight: bold;
}

.main-content {
  flex: 1;
  overflow: hidden;
}
</style>
