import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { applyPortalSeo } from './lib/seo'
import './style.css'

const app = createApp(App).use(router)
app.mount('#app')

router.isReady().then(() => {
  applyPortalSeo(router.currentRoute.value.path)
})
