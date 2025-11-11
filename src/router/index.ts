import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    { path: '/', name: 'home', component: () => import('../pages/HomePage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
]

const router = createRouter({
    history: createWebHistory('/'), // 组织主页：根路径
    routes,
})

export default router
