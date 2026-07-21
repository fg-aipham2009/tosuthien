<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import MiniPlayer from '../components/MiniPlayer.vue'

const route = useRoute()
const tabs = [
  { to: '/', label: 'Hỏi Đáp', match: (p: string) => p === '/' },
  { to: '/mp3', label: 'MP3', match: (p: string) => p.startsWith('/mp3') },
  { to: '/kinh-sach', label: 'Kinh sách', match: (p: string) => p.startsWith('/kinh-sach') },
  { to: '/thien-duong', label: 'Thiền đường', match: (p: string) => p.startsWith('/thien-duong') },
] as const

const activePath = computed(() => route.path)
const isChat = computed(() => route.path === '/')
</script>

<template>
  <div class="shell" :class="{ chat: isChat }">
    <header class="top">
      <RouterLink class="brand" to="/">
        <img src="/logo-tosuthien.png" alt="" width="36" height="36" />
        <span>Tổ Sư Thiền</span>
      </RouterLink>
      <nav class="desk-nav" aria-label="Chính">
        <RouterLink
          v-for="t in tabs"
          :key="t.to"
          :to="t.to"
          class="desk-link"
          :class="{ active: t.match(activePath) }"
        >
          {{ t.label }}
        </RouterLink>
      </nav>
    </header>

    <main class="main" :class="{ flush: isChat }">
      <RouterView />
    </main>

    <MiniPlayer />

    <nav class="bottom" aria-label="Tab">
      <RouterLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="tab"
        :class="{ active: t.match(activePath) }"
      >
        {{ t.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f7f2f0;
  color: #1d1b1a;
}

.shell.chat {
  background: #ffffff;
}

.top {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid rgba(154, 142, 138, 0.28);
  background: #fffbff;
  z-index: 20;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  font-size: 1.05rem;
  color: #5d4037;
}

.brand img {
  border-radius: 50%;
}

.desk-nav {
  display: none;
  gap: 0.35rem;
}

.desk-link {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  color: #605d5c;
  font-size: 0.92rem;
}

.desk-link.active,
.desk-link:hover {
  color: #fff;
  background: #5d4037;
}

.main {
  flex: 1;
  min-height: 0;
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 1rem clamp(1rem, 3vw, 1.5rem);
  overflow: auto;
}

.main.flush {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.bottom {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.15rem;
  padding: 0.4rem 0.35rem calc(0.4rem + env(safe-area-inset-bottom));
  background: #fffbff;
  border-top: 1px solid rgba(154, 142, 138, 0.28);
  z-index: 30;
}

.tab {
  text-align: center;
  padding: 0.55rem 0.2rem;
  font-size: 0.78rem;
  color: #605d5c;
  border-radius: 10px;
  font-weight: 500;
}

.tab.active {
  color: #5d4037;
  background: rgba(93, 64, 55, 0.1);
  font-weight: 700;
}

@media (min-width: 860px) {
  .desk-nav {
    display: flex;
  }

  .bottom {
    display: none;
  }

  .main:not(.flush) {
    padding-bottom: 2rem;
  }
}
</style>
