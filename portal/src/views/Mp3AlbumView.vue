<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { listCategories, listFolders, listTracks, listYears } from '../api/mp3'
import { usePlayer } from '../stores/player'
import {
  downloadFolderZip,
  downloadTrackMp3,
  folderDisplayName,
} from '../utils/mp3Download'
import type { MediaCategory, Mp3Track } from '../types'

const route = useRoute()
const router = useRouter()
const { playQueue, current, state, toggle } = usePlayer()

const cat = ref<MediaCategory | null>(null)
const folderPaths = ref<string[]>([])
const tracks = ref<Mp3Track[]>([])
const years = ref<number[]>([])
const selectedYear = ref<number | null>(null)
const loading = ref(true)
const error = ref('')
const q = ref('')
const downloadingId = ref<string | null>(null)
const zipBusy = ref<string | null>(null)

const slug = computed(() => String(route.params.slug))
const activeFolder = computed(() => {
  const raw = route.query.folder
  return typeof raw === 'string' && raw.trim() ? raw : null
})

const filteredFolders = computed(() => {
  const s = q.value.trim().toLowerCase()
  const rows = folderPaths.value.map((path) => ({
    path,
    name: folderDisplayName(path),
  }))
  const list = s
    ? rows.filter((f) => f.name.toLowerCase().includes(s) || f.path.toLowerCase().includes(s))
    : rows
  return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
})

const filteredTracks = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return tracks.value
  return tracks.value.filter((t) => t.title.toLowerCase().includes(s))
})

async function loadYears() {
  years.value = await listYears({
    category: slug.value,
    folder: activeFolder.value ?? undefined,
  })
  if (selectedYear.value != null && !years.value.includes(selectedYear.value)) {
    selectedYear.value = null
  }
}

async function loadFolderList() {
  folderPaths.value = await listFolders({
    category: slug.value,
    year: selectedYear.value ?? undefined,
  })
  tracks.value = []
}

async function loadFolderTracks() {
  const folder = activeFolder.value
  if (!folder) {
    tracks.value = []
    return
  }
  tracks.value = await listTracks({
    category: slug.value,
    folder,
    year: selectedYear.value ?? undefined,
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const cats = await listCategories()
    cat.value = cats.find((c) => c.slug === slug.value) ?? null
    await loadYears()
    if (activeFolder.value) {
      await loadFolderTracks()
      folderPaths.value = []
    } else {
      await loadFolderList()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được bài'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([() => route.params.slug, () => route.query.folder], load)

watch(selectedYear, async () => {
  loading.value = true
  error.value = ''
  try {
    if (activeFolder.value) {
      await loadFolderTracks()
    } else {
      await loadFolderList()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được bài'
  } finally {
    loading.value = false
  }
})

function openFolder(path: string) {
  q.value = ''
  router.push({
    name: 'mp3-album',
    params: { slug: slug.value },
    query: { folder: path },
  })
}

function backToFolders() {
  q.value = ''
  selectedYear.value = null
  router.push({ name: 'mp3-album', params: { slug: slug.value } })
}

function selectYear(year: number | null) {
  selectedYear.value = year
}

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
    <h1 class="mt-2 mb-1 font-serif text-2xl font-bold lg:text-3xl">{{ cat?.name || 'Album' }}</h1>
    <p v-if="activeFolder" class="mb-4 text-sm text-muted">
      <button type="button" class="font-semibold text-brand hover:underline" @click="backToFolders">
        ← Thư mục
      </button>
      <span class="mx-1.5 text-black/20">/</span>
      <span>{{ folderDisplayName(activeFolder) }}</span>
    </p>
    <p v-else class="mb-4 text-sm text-muted">Chọn thư mục để nghe — tải nhanh hơn từng phần.</p>

    <input
      v-model="q"
      class="mb-4 w-full rounded-xl border border-black/10 bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-brand/40"
      type="search"
      :placeholder="activeFolder ? 'Tìm trong thư mục…' : 'Tìm thư mục…'"
    />

    <div v-if="years.length > 1" class="mb-4">
      <p class="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Lọc theo năm</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-sm font-semibold transition"
          :class="
            selectedYear == null
              ? 'border-brand bg-brand text-white'
              : 'border-black/10 bg-surface text-ink hover:border-brand/30'
          "
          @click="selectYear(null)"
        >
          Tất cả
        </button>
        <button
          v-for="year in years"
          :key="year"
          type="button"
          class="rounded-full border px-3 py-1 text-sm font-semibold transition"
          :class="
            selectedYear === year
              ? 'border-brand bg-brand text-white'
              : 'border-black/10 bg-surface text-ink hover:border-brand/30'
          "
          @click="selectYear(year)"
        >
          {{ year }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <p v-else-if="error" class="text-red-800">{{ error }}</p>

    <!-- Folder list (Flutter-style) -->
    <template v-else-if="!activeFolder">
      <p v-if="!filteredFolders.length" class="text-muted">Không có thư mục nào.</p>
      <ul v-else class="space-y-2">
        <li v-for="folder in filteredFolders" :key="folder.path">
          <div
            class="flex items-center gap-2 rounded-2xl border border-black/10 bg-surface transition hover:border-brand/30 hover:shadow-sm"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
              @click="openFolder(folder.path)"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-serif text-lg font-semibold text-ink">
                  {{ folder.name }}
                </span>
                <span class="text-xs text-muted">Mở thư mục</span>
              </span>
            </button>
            <button
              type="button"
              class="mr-2 grid size-9 shrink-0 place-items-center rounded-full text-brand transition hover:bg-brand/10 disabled:opacity-40"
              :disabled="zipBusy === folder.path"
              title="Tải về cả thư mục (ZIP)"
              aria-label="Tải về cả thư mục"
              @click="onDownloadFolder(folder.path, $event)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      </ul>
    </template>

    <!-- Tracks inside one folder -->
    <template v-else>
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="text-sm text-muted">{{ filteredTracks.length }} bài</p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-surface px-3 py-1.5 text-sm font-semibold text-brand transition hover:border-brand/30 disabled:opacity-40"
          :disabled="zipBusy === activeFolder"
          @click="onDownloadFolder(activeFolder, $event)"
        >
          Tải ZIP
        </button>
      </div>

      <p v-if="!filteredTracks.length" class="text-muted">Không có bài nào.</p>
      <ol v-else class="divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10 bg-surface">
        <li v-for="(t, i) in filteredTracks" :key="t.id">
          <div
            class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-1 px-3 py-2.5 transition hover:bg-paper"
            :class="isActive(t) ? 'bg-[#efe6df]/70' : ''"
          >
            <button
              type="button"
              class="font-serif text-brand"
              :aria-label="`Phát ${t.title}`"
              @click="playAt(filteredTracks, i)"
            >
              <template v-if="isActive(t) && state.playing">♪</template>
              <template v-else>{{ i + 1 }}</template>
            </button>

            <button
              type="button"
              class="min-w-0 p-0 text-left leading-snug"
              :class="isActive(t) ? 'font-semibold text-brand' : ''"
              @click="playAt(filteredTracks, i)"
            >
              <span class="block truncate">{{ t.title }}</span>
              <span v-if="t.year" class="text-xs text-muted">{{ t.year }}</span>
              <span v-if="isActive(t)" class="ml-2 text-xs font-semibold text-brand">
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
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.25" />
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
    </template>
  </div>
</template>
