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

async function onDownloadTrack(t: Mp3Track, e: Event) {
  e.stopPropagation()
  if (downloadingId.value) return
  downloadingId.value = t.id
  try {
    await downloadTrackMp3(t)
  } catch {
    // Keep silent UI — icon is enough; browser may still show errors.
  } finally {
    downloadingId.value = null
  }
}

function onDownloadFolder(folderPath: string, e: Event) {
  e.stopPropagation()
  zipBusy.value = folderPath
  downloadFolderZip(folderPath)
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
          class="flex items-center justify-between gap-2 border-b border-black/10 bg-paper/80 px-3.5 py-3"
        >
          <div class="min-w-0">
            <h2 class="truncate font-serif text-lg font-semibold text-ink">{{ folder.name }}</h2>
            <p class="text-xs text-muted">{{ folder.items.length }} bài</p>
          </div>
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full text-brand transition hover:bg-brand/10 disabled:opacity-40"
            :disabled="zipBusy === folder.path"
            title="Tải về cả thư mục (ZIP)"
            aria-label="Tải về cả thư mục"
            @click="onDownloadFolder(folder.path, $event)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </header>

        <ol class="divide-y divide-black/10">
          <li v-for="(t, i) in folder.items" :key="t.id">
            <div
              class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-1 px-3 py-2.5 transition hover:bg-paper"
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
                class="grid size-9 place-items-center rounded-full text-muted transition hover:bg-brand/10 hover:text-brand disabled:opacity-40"
                :disabled="downloadingId === t.id"
                title="Tải về"
                aria-label="Tải về"
                @click="onDownloadTrack(t, $event)"
              >
                <svg
                  v-if="downloadingId === t.id"
                  class="animate-spin"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    stroke-width="2"
                    opacity="0.25"
                  />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
