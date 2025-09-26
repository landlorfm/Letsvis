<template>
  <div
    ref="chartContainer"
    class="base-chart"
    :style="{ width: containerWidth, height: containerHeight }"
  ></div>
</template>

<script>
import EChartsManager from '@/core/visualization/echarts-manager';

export default {
  name: 'BaseChart',

  props: {
    // 图表配置选项
    option: {
      type: Object,
      default: () => ({})
    },
    
    // 图表主题
    theme: {
      type: [String, Object],
      default: 'light'
    },
    
    // 初始化参数
    initOpts: {
      type: Object,
      default: () => ({})
    },
    
    // 是否开启自动resize
    autoResize: {
      type: Boolean,
      default: true
    },
    
    // 容器宽度
    width: {
      type: String,
      default: '100%'
    },
    
    // 容器高度
    height: {
      type: String,
      default: '400px'
    },
    
    // 是否启用懒加载
    lazyLoad: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      chartManager: null,
      observer: null,
      isInViewport: !this.lazyLoad
    };
  },

  computed: {
    containerWidth() {
      return this.width;
    },
    
    containerHeight() {
      return this.height;
    },
    
    // EChartsManager的配置选项
    managerOptions() {
      return {
        theme: this.theme,
        autoResize: this.autoResize,
        renderer: this.initOpts.renderer || 'canvas',
        resizeThrottle: this.initOpts.resizeThrottle || 150,
        width: this.initOpts.width,
        height: this.initOpts.height
      };
    }
  },

  watch: {
    // 监听option变化
    option: {
      handler(newOption) {
        if (this.chartManager && newOption) {
          this.chartManager.setOption(newOption);
        }
      },
      deep: true
    },
    
    // 监听主题变化
    theme(newTheme) {
      if (this.chartManager) {
        this.disposeChart();
        this.$nextTick(() => {
          this.initChart();
        });
      }
    }
  },

  mounted() {
    if (this.lazyLoad) {
      this.setupIntersectionObserver();
    } else {
      this.initChart();
    }
  },

  beforeUnmount() {
    this.disposeChart();
    this.removeIntersectionObserver();
  },

  methods: {
    // 初始化图表
    initChart() {
      if (!this.$refs.chartContainer || !this.isInViewport) return;
      
      try {
        // 创建EChartsManager实例
        this.chartManager = new EChartsManager(
          this.$refs.chartContainer,
          this.managerOptions
        );

        // 设置初始option
        if (this.option) {
          this.chartManager.setOption(this.option);
        }

        // 注册事件监听器，将ECharts事件转发到Vue组件
        this.setupEventForwarding();

        // 触发初始化完成事件
        this.$emit('chart-init', this.chartManager);
      } catch (error) {
        console.error('Failed to initialize chart:', error);
        this.$emit('chart-error', error);
      }
    },

    // 销毁图表实例
    disposeChart() {
      if (this.chartManager) {
        this.chartManager.dispose();
        this.chartManager = null;
        this.$emit('chart-dispose');
      }
    },

    // 设置事件转发
    setupEventForwarding() {
      if (!this.chartManager) return;

      // 常见ECharts事件类型
      const eventTypes = [
        'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
        'mouseover', 'mouseout', 'globalout', 'contextmenu',
        'highlight', 'downplay', 'selectchanged', 'legendselectchanged',
        'legendselected', 'legendunselected', 'legendselectall',
        'legendinverseselect', 'legendscroll', 'datazoom',
        'datarangeselected', 'graphroam', 'georoam', 'treeroam',
        'timelinechanged', 'timelineplaychanged', 'restore',
        'dataviewchanged', 'magictypechanged', 'geoselectchanged',
        'geoselected', 'geounselected', 'pieselectchanged',
        'pieselected', 'pieunselected', 'mapselectchanged',
        'mapselected', 'mapunselected', 'axisareaselected',
        'focusnodeadjacency', 'unfocusnodeadjacency', 'brush',
        'brushselected', 'rendered', 'finished'
      ];

      // 为每种事件类型注册转发
      eventTypes.forEach(eventType => {
        this.chartManager.on(eventType, (params) => {
          this.$emit(eventType, params);
        });
      });
    },

    // 设置Intersection Observer用于懒加载
    setupIntersectionObserver() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                this.isInViewport = true;
                this.initChart();
                this.removeIntersectionObserver();
              }
            });
          },
          {
            rootMargin: '50px',
            threshold: 0.01
          }
        );
        
        this.observer.observe(this.$refs.chartContainer);
      } else {
        // 浏览器不支持Intersection Observer，直接初始化
        this.isInViewport = true;
        this.initChart();
      }
    },

    // 移除Intersection Observer
    removeIntersectionObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    },

    // 手动调整大小
    resize(options = {}) {
      if (this.chartManager) {
        this.chartManager.resize(options);
      }
    },

    // 获取EChartsManager实例
    getManager() {
      return this.chartManager;
    },

    // 获取原生ECharts实例
    getInstance() {
      return this.chartManager ? this.chartManager.getInstance() : null;
    },

    // 显示loading
    showLoading(config) {
      if (this.chartManager) {
        this.chartManager.showLoading(config);
      }
    },

    // 隐藏loading
    hideLoading() {
      if (this.chartManager) {
        this.chartManager.hideLoading();
      }
    },

    // 清空图表
    clear() {
      if (this.chartManager) {
        this.chartManager.clear();
      }
    },

    // 获取当前配置
    getOption() {
      return this.chartManager ? this.chartManager.getOption() : null;
    }
  }
};
</script>

<style scoped>
.base-chart {
  position: relative;
}
</style>