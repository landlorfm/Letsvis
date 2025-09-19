<template>
  <div class="timestep-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
    </div>

    <!-- 可视化区域 -->
    <div class="visualization-area">
      <timestep-chart
        ref="timestepChart"
        :data="renderData"
        :settings="renderData?.settings"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import FileSelector from '@/ui/components/file-selector.vue'
import TimestepChart from '@/ui/components/charts/timestep-chart.vue'

/* -------- 状态 -------- */
const renderData = ref(null)   // 当前选中配置 {settings, entries}

/* -------- 生命周期 -------- */
onMounted(async () => {
  await nextTick()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

/* -------- 事件处理 -------- */
/** 文件加载完成（worker 回包） */
function onFileLoaded (parsedData) {
  const { timestep: timestepList, valid, chip } = parsedData
  console.log('Timestep data:', { timestep: timestepList, valid, chip })

  if (!valid.timestep || !timestepList?.length) {
    console.warn('[TimestepView] No valid timestep data')
    return
  }

  // 把芯片信息合并到 settings
  if (chip) {
    timestepList.forEach(cfg => Object.assign(cfg.settings, chip))
  }

  // 默认展示第一组配置
  renderData.value = timestepList[0]
}

/** 窗口尺寸变化 */
function onResize () {
  refs.timestepChart?.resize()
}
</script>

<style scoped>
.timestep-view {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
  background: #f8f9fa;
}

.toolbar {
  grid-row: 1;
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.visualization-area {
  grid-row: 2;
  height: 80%;
  overflow: hidden;
}
</style>