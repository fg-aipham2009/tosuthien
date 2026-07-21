<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { listCategories, listTracks } from '../api/mp3'
import { usePlayer } from '../stores/player'
import {
  downloadFolderZip,
  downloadTrackMp3,
  folderDisplayName,
} from '../utils/mp3Download'
import type { MediaCategory, Mp3Track } from '../types'

const route = useRoute()
const { playQueue, current, state, toggle } = usePlayer()
const cat = ref<MediaCategory | null>(null)
const tracks = ref<Mp3Track[]>([])
const loading = ref(true)
const error = ref('')
const q = ref('')
const downloadingId = ref<string | null>(null)
const zipBusy = ref<string | null>(null)
const toast = ref('')

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return tracks.value
  return tracks.value.filter((t) => t.title.toLowerCase().includes(s))
})

const folders = computed(() => {
  const map = new Map<string, Mp3Track[]>()
  for (const t of filtered.value) {
    const key = t.folderPath || '(root)/'
    const list = map.get(key) ?? []
    list.push(t)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([path, items]) => ({ path, items, name: folderDisplayName(path) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
})

onMounted(async () => {
  try {
    const slug = String(route.params.slug)
    const cats = await listCategories()
    cat.value = cats.find((c) => c.slug === slug) ?? null
    tracks.value = await listTracks({ category: slug })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được bài'
  } finally {
    loading.value = false
  }
})

function playAt(list: Mp3Track[], i: number) {
  const track = list[i]
  if (!track) return
  if (current.value?.id === track.id) {
    toggle()
    return
  }
  playQueue(list, i)
}

function isActive(t: Mp3Track) {
  return current.value?.id === t.id
}

function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = ''
  }, 3200)
}

async function onDownloadTrack(t: Mp3Track, e: Event) {
  e.stopPropagation()
  if (downloadingId.value) return
  downloadingId.value = t.id
  try {
    await downloadTrackMp3(t)
    showToast(`Đã tải: ${t.filename || t.title}`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Tải thất bại')
  } finally {
    downloadingId.value = null
  }
}

function onDownloadFolder(folderPath: string, e: Event) {
  e.stopPropagation()
  zipBusy.value = folderPath
  downloadFolderZip(folderPath)
  showToast('Đang tải ZIP thư mục… (có thể vài trăm MB–GB)')
  window.setTimeout(() => {
    if (zipBusy.value === folderPath) zipBusy.value = null
  }, 1500)
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl pb-28">
    <RouterLink class="text-sm font-semibold text-brand" to="/mp3">← Album</RouterLink>
    <h1 class="mt-2 mb-4 font-serif text-2xl font-bold lg:text-3xl">{{ cat?.name || 'Album' }}</h1>

    <input
      v-model="q"
      class="mb-4 w-full rounded-xl border border-black/10 bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-brand/40"
      type="search"
      placeholder="Tìm trong album…"
    />

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <p v-else-if="error" class="text-red-800">{{ error }}</p>
    <p v-else-if="!filtered.length" class="text-muted">Không có bài nào.</p>

    <div v-else class="space-y-5">
      <section
        v-for="folder in folders"
        :key="folder.path"
        class="overflow-hidden rounded-2xl border border-black/10 bg-surface"
      >
        <header
          class="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-paper/80 px-3.5 py-3"
        >
          <div class="min-w-0">
            <h2 class="truncate font-serif text-lg font-semibold text-ink">{{ folder.name }}</h2>
            <p class="text-xs text-muted">{{ folder.items.length }} bài · tải từng file .mp3 hoặc cả thư mục .zip</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand hover:bg-brand/15 disabled:opacity-50"
            :disabled="zipBusy === folder.path"
            @click="onDownloadFolder(folder.path, $event)"
          >
            {{ zipBusy === folder.path ? 'Đang mở…' : 'Tải ZIP thư mục' }}
          </button>
        </header>

        <ol class="divide-y divide-black/10">
          <li v-for="(t, i) in folder.items" :key="t.id">
            <div
              class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 px-3 py-2.5 transition hover:bg-paper"
              :class="isActive(t) ? 'bg-[#efe6df]/70' : ''"
            >
              <button
                type="button"
                class="font-serif text-brand"
                :aria-label="`Phát ${t.title}`"
                @click="playAt(folder.items, i)"
              >
                <template v-if="isActive(t) && state.playing">♪</template>
                <template v-else>{{ i + 1 }}</template>
              </button>

              <button
                type="button"
                class="min-w-0 p-0 text-left leading-snug"
                :class="isActive(t) ? 'font-semibold text-brand' : ''"
                @click="playAt(folder.items, i)"
              >
                <span class="block truncate">{{ t.title }}</span>
                <span v-if="isActive(t)" class="text-xs font-semibold text-brand">
                  {{ state.playing ? 'Đang phát' : 'Tạm dừng' }}
                </span>
              </button>

              <button
                type="button"
                class="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand/40 hover:text-brand disabled:opacity-50"
                :disabled="downloadingId === t.id"
                :title="`Tải ${t.filename || t.title}`"
                @click="onDownloadTrack(t, $event)"
              >
                {{ downloadingId === t.id ? '…' : 'Tải MP3' }}
              </button>
            </div>
          </li>
        </ol>
      </section>
    </div>

    <div
      v-if="toast"
      class="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-full bg-[#2a1810] px-4 py-2 text-sm text-white shadow-lg lg:bottom-24"
    >
      {{ toast }}
    </div>
  </div>
</template>
