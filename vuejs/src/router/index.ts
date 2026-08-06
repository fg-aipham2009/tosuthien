import { createRouter, createWebHistory } from 'vue-router';
import AdminLayout from '@/layouts/AdminLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: '', redirect: '/centers' },
        {
          path: 'centers',
          name: 'centers',
          component: () => import('@/views/CentersView.vue'),
          meta: { title: 'Thiền viện / Thiền đường' },
        },
        {
          path: 'centers/new',
          name: 'center-new',
          component: () => import('@/views/CenterEditView.vue'),
          meta: { title: 'Thêm thiền viện' },
        },
        {
          path: 'centers/:id',
          name: 'center-edit',
          component: () => import('@/views/CenterEditView.vue'),
          meta: { title: 'Sửa thiền viện' },
        },
        {
          path: 'files',
          name: 'files',
          component: () => import('@/views/FilesView.vue'),
          meta: { title: 'Quản lý file' },
        },
        {
          path: 'books',
          name: 'books',
          component: () => import('@/views/BooksView.vue'),
          meta: { title: 'Kinh sách — ảnh bìa' },
        },
        {
          path: 'youtube',
          name: 'youtube',
          component: () => import('@/views/YoutubeView.vue'),
          meta: { title: 'YouTube' },
        },
        {
          path: 'posts',
          name: 'posts',
          component: () => import('@/views/PostsView.vue'),
          meta: { title: 'Tin tức' },
        },
        {
          path: 'posts/new',
          name: 'post-new',
          component: () => import('@/views/PostEditView.vue'),
          meta: { title: 'Thêm tin tức' },
        },
        {
          path: 'posts/:id',
          name: 'post-edit',
          component: () => import('@/views/PostEditView.vue'),
          meta: { title: 'Sửa tin tức' },
        },
      ],
    },
  ],
});

export default router;
