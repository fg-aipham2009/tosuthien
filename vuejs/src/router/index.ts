import { createRouter, createWebHistory } from 'vue-router';
import AdminLayout from '@/layouts/AdminLayout.vue';
import { useAuth } from '@/composables/useAuth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: 'Đăng nhập' },
    },
    {
      path: '/',
      component: AdminLayout,
      meta: { requiresAuth: true },
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
        {
          path: 'admins',
          name: 'admins',
          component: () => import('@/views/AdminUsersView.vue'),
          meta: { title: 'Tài khoản admin' },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth();
  if (to.meta.public) {
    if (isAuthenticated.value && to.path === '/login') {
      return '/centers';
    }
    return true;
  }
  if (to.meta.requiresAuth || to.matched.some((r) => r.meta.requiresAuth)) {
    if (!isAuthenticated.value) {
      return { path: '/login', query: { redirect: to.fullPath } };
    }
  }
  return true;
});

export default router;
