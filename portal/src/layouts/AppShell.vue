<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import MiniPlayer from '../components/MiniPlayer.vue'

type PwaApi = {
  canInstall: () => boolean
  isStandalone?: () => boolean
  onChange: (fn: (can: boolean) => void) => () => void
  install: () => Promise<boolean | { ok: boolean; reason?: string; outcome?: string }>
}

declare global {
  interface Window {
    tosuthienPwa?: PwaApi
  }
}

const route = useRoute()
const tabs = [
  { to: '/', label: 'Hỏi Đáp', match: (p: string) => p === '/' },
  { to: '/mp3', label: 'MP3', match: (p: string) => p.startsWith('/mp3') },
  { to: '/kinh-sach', label: 'Kinh sách', match: (p: string) => p.startsWith('/kinh-sach') },
  { to: '/thien-duong', label: 'Thiền đường', match: (p: string) => p.startsWith('/thien-duong') },
] as const

const activePath = computed(() => route.path)
const isChat = computed(() => route.path === '/')
const canInstall = ref(false)
const installHint = ref('')
const installing = ref(false)
let offPwa: (() => void) | undefined
let syncTimer1 = 0
let syncTimer2 = 0

function syncInstallable() {
  canInstall.value = !!window.tosuthienPwa?.canInstall()
}

onMounted(() => {
  syncInstallable()
  offPwa = window.tosuthienPwa?.onChange((can) => {
    canInstall.value = can
  })
  window.addEventListener('tosuthien-pwa', syncInstallable)
  // SW / prompt có thể sẵn sàng sau vài giây
  syncTimer1 = window.setTimeout(syncInstallable, 800)
  syncTimer2 = window.setTimeout(syncInstallable, 2500)
})

onUnmounted(() => {
  offPwa?.()
  window.removeEventListener('tosuthien-pwa', syncInstallable)
  window.clearTimeout(syncTimer1)
  window.clearTimeout(syncTimer2)
})

/** Giống nút Cài đặt banner cũ: mở hộp thoại cài PWA. */
async function installApp() {
  if (installing.value) return
  installHint.value = ''
  installing.value = true
  try {
    const result = await window.tosuthienPwa?.install()
    const ok = result === true || (typeof result === 'object' && result?.ok)
    if (ok) return
    if (window.tosuthienPwa?.isStandalone?.()) {
      installHint.value = 'Ứng dụng đã được cài trên máy này.'
      return
    }
    const ua = navigator.userAgent
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    installHint.value = isIOS
      ? 'Trên iPhone/iPad: bấm Share → Thêm vào Màn hình chính.'
      : 'Đang chờ trình duyệt cho phép cài. Thử Chrome/Edge, mở https://tosuthien.net rồi bấm lại Cài đặt.'
  } finally {
    installing.value = false
  }
}
</script>

<template>
  <div
    class="flex h-dvh flex-col bg-paper text-ink"
    :class="{ 'bg-surface': isChat }"
  >
    <header
      class="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-surface px-4 py-2.5 lg:px-8"
    >
      <RouterLink class="inline-flex items-center gap-2.5 text-[1.05rem] font-semibold text-brand" to="/">
        <img class="size-9 rounded-full" src="/logo-tosuthien.png" alt="" width="36" height="36" />
        <span>Tổ Sư Thiền</span>
      </RouterLink>
      <div class="flex items-center gap-2">
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
        <button
          type="button"
          class="rounded-full px-3.5 py-2 text-[0.92rem] font-semibold transition"
          :class="
            canInstall
              ? 'bg-brand text-white hover:bg-brand-deep'
              : 'border border-brand/25 bg-brand/5 text-brand hover:bg-brand hover:text-white'
          "
          title="Cài đặt tosuthien.net như ứng dụng (PWA)"
          :disabled="installing"
          @click="installApp"
        >
          {{ installing ? 'Đang cài…' : 'Cài đặt' }}
        </button>
      </div>
    </header>
    <p
      v-if="installHint"
      class="shrink-0 border-b border-black/10 bg-brand/5 px-4 py-2 text-center text-sm text-brand lg:px-8"
      role="status"
    >
      {{ installHint }}
      <button type="button" class="ml-2 font-semibold underline" @click="installHint = ''">Đóng</button>
    </p>

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
