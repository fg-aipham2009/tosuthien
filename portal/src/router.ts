import { createRouter, createWebHistory } from 'vue-router'

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
      meta: { title: 'MP3' },
    },
    {
      path: '/mp3/:slug',
      name: 'mp3-album',
      component: () => import('./views/Mp3AlbumView.vue'),
      meta: { title: 'Album MP3' },
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
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const t = (to.meta.title as string) || 'Tổ Sư Thiền'
  document.title = `${t} · Tổ Sư Thiền`
})

export default router
