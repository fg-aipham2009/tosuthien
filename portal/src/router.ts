import { createRouter, createWebHistory } from 'vue-router'
import { applyPortalSeo } from './lib/seo'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('./views/ChatView.vue'),
      meta: { title: 'Hỏi Đáp' },
    },
    {
      path: '/mp3',
      name: 'mp3',
      component: () => import('./views/Mp3View.vue'),
      meta: { title: 'Pháp Âm' },
    },
    {
      path: '/mp3/:slug',
      name: 'mp3-album',
      component: () => import('./views/Mp3AlbumView.vue'),
      meta: { title: 'Album Pháp Âm' },
    },
    {
      path: '/kinh-sach',
      name: 'books',
      component: () => import('./views/BooksView.vue'),
      meta: { title: 'Kinh sách' },
    },
    {
      path: '/kinh-sach/pdf/:id',
      name: 'book-pdf',
      component: () => import('./views/BookPdfView.vue'),
      meta: { title: 'Đọc PDF' },
    },
    {
      path: '/kinh-sach/chu/:id',
      name: 'book-text',
      component: () => import('./views/BookTextView.vue'),
      meta: { title: 'Đọc chữ' },
    },
    {
      path: '/thien-duong',
      name: 'centers',
      component: () => import('./views/CentersView.vue'),
      meta: { title: 'Thiền đường' },
    },
    {
      path: '/thien-duong/:id',
      name: 'center-detail',
      component: () => import('./views/CenterDetailView.vue'),
      meta: { title: 'Chi tiết thiền đường' },
    },
    {
      path: '/chinh-sach-bao-mat',
      name: 'privacy',
      component: () => import('./views/PrivacyPolicyView.vue'),
      meta: { title: 'Chính sách quyền riêng tư' },
    },
    {
      path: '/dieu-khoan',
      name: 'terms',
      component: () => import('./views/TermsOfServiceView.vue'),
      meta: { title: 'Điều khoản sử dụng' },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  applyPortalSeo(to.path)
})

export default router
