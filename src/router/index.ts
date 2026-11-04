import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/lexikon',
      name: 'lexikon',
      component: () => import('../views/Lexikon.vue')
    },
    {
      path: '/module/:id',
      name: 'module',
      component: () => import('../views/ModuleView.vue')
    },
    {
      path: '/module/:id/:subId',
      name: 'sub-module',
      component: () => import('../views/SubModuleView.vue')
    },
    {
      path: '/docs/:filename?',
      name: 'docs',
      component: () => import('../views/DocsView.vue')
    },
    {
      path: '/budget',
      name: 'budget',
      component: () => import('../views/BudgetView.vue')
    },
    {
      path: '/oe',
      name: 'oe',
      component: () => import('../views/OEView.vue')
    }
  ]
})

export default router
