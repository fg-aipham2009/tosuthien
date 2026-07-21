<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const activeMenu = computed(() => {
  if (route.path.startsWith('/centers')) return '/centers';
  if (route.path.startsWith('/files')) return '/files';
  if (route.path.startsWith('/books')) return '/books';
  if (route.path.startsWith('/youtube')) return '/youtube';
  return route.path;
});

const pageTitle = computed(() => (route.meta.title as string) ?? 'Admin');

function go(path: string) {
  router.push(path);
}
</script>

<template>
  <el-container class="admin-shell">
    <el-aside width="240px" class="admin-aside">
      <div class="brand" @click="go('/centers')">
        <span class="brand-title">Tổ Sư Thiền</span>
        <span class="brand-sub">Admin</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        class="admin-menu"
      >
        <el-menu-item index="/centers">
          <el-icon><Location /></el-icon>
          <span>Thiền viện / Thiền đường</span>
        </el-menu-item>
        <el-menu-item index="/books">
          <el-icon><Reading /></el-icon>
          <span>Kinh sách (ảnh bìa)</span>
        </el-menu-item>
        <el-menu-item index="/files">
          <el-icon><FolderOpened /></el-icon>
          <span>File &amp; thư mục</span>
        </el-menu-item>
        <el-menu-item index="/youtube">
          <el-icon><VideoCamera /></el-icon>
          <span>YouTube</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <h2>{{ pageTitle }}</h2>
      </el-header>
      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
}

.admin-aside {
  background: #1f2937;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.brand {
  padding: 20px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-title {
  display: block;
  font-size: 1.1rem;
  font-weight: 700;
}

.brand-sub {
  font-size: 0.8rem;
  opacity: 0.65;
}

.admin-menu {
  border-right: none;
  background: transparent;
  flex: 1;
}

.admin-menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.85);
}

.admin-menu :deep(.el-menu-item.is-active) {
  background: rgba(64, 158, 255, 0.2);
  color: #fff;
}

.admin-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
}

.admin-header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  height: 56px;
}

.admin-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.admin-main {
  padding: 24px;
  max-width: 1200px;
}
</style>
