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
  <div
    class="flex h-dvh flex-col bg-paper text-ink"
    :class="{ 'bg-surface': isChat }"
  >
    <header
      class="z-20 flex shrink-0 items-center justify-between gap-4 border-b border-black/10 bg-surface px-4 py-2.5 lg:px-8"
    >
      <RouterLink class="inline-flex items-center gap-2.5 text-[1.05rem] font-semibold text-brand" to="/">
        <img class="size-9 rounded-full" src="/logo-tosuthien.png" alt="" width="36" height="36" />
        <span>Tổ Sư Thiền</span>
      </RouterLink>
      <nav class="hidden gap-1 lg:flex" aria-label="Chính">
        <RouterLink
          v-for="t in tabs"
          :key="t.to"
          :to="t.to"
          class="rounded-full px-3.5 py-2 text-[0.92rem] text-muted transition hover:bg-brand hover:text-white"
          :class="{ 'bg-brand font-semibold text-white': t.match(activePath) }"
        >
          {{ t.label }}
        </RouterLink>
      </nav>
    </header>

    <main
      class="min-h-0 flex-1 overflow-auto"
      :class="
        isChat
          ? 'flex w-full flex-col overflow-hidden p-0'
          : 'w-full max-w-none px-4 py-4 sm:px-6 lg:px-8 lg:py-6 xl:px-10'
      "
    >
      <RouterView />
    </main>

    <MiniPlayer />

    <nav
      class="z-30 grid shrink-0 grid-cols-4 gap-0.5 border-t border-black/10 bg-surface px-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      aria-label="Tab"
    >
      <RouterLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="rounded-[10px] px-1 py-2.5 text-center text-[0.78rem] font-medium text-muted"
        :class="{ 'bg-brand/10 font-bold text-brand': t.match(activePath) }"
      >
        {{ t.label }}
      </RouterLink>
    </nav>
  </div>
</template>
