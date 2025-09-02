import { createRouter, createWebHashHistory } from 'vue-router'
import LmemView from '../ui/views/lmem-view.vue'
import TimestepView from '../ui/views/timestep-view.vue'


const routes = [
  {
    path: '/',
    redirect: '/lmem'
  },
  {
    path: '/lmem',
    name: 'lmem',
    component: LmemView
  },
  {
    path: '/timestep',
    name: 'timestep',
    component: TimestepView
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router