import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'

// 如果你计划绑定自定义域名（域名直达该项目），将 USE_CUSTOM_DOMAIN 设为 'true'
// 否则使用仓库路径 /<repo>/ 作为 base
const useCustomDomain = process.env.USE_CUSTOM_DOMAIN === 'true'
// ⚠️ 把 <repo> 改成你的仓库名
const repo = 'vue-pages-ts-demo'

export default defineConfig({
    plugins: [vue()],
    base: useCustomDomain ? '/' : `/${repo}/`,
    build: { outDir: 'dist' },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',
        },
    },
})