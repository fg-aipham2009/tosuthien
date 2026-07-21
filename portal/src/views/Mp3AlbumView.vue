<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { listCategories, listTracks } from '../api/mp3'
import { usePlayer } from '../stores/player'
import type { MediaCategory, Mp3Track } from '../types'

const route = useRoute()
const { playQueue } = usePlayer()
const cat = ref<MediaCategory | null>(null)
const tracks = ref<Mp3Track[]>([])
const loading = ref(true)
const error = ref('')
const q = ref('')

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return tracks.value
  return tracks.value.filter((t) => t.title.toLowerCase().includes(s))
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

function playAt(i: number) {
  playQueue(filtered.value, i)
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
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

    <ol v-else class="divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10 bg-surface">
      <li v-for="(t, i) in filtered" :key="t.id">
        <button
          type="button"
          class="grid w-full grid-cols-[2.5rem_1fr] gap-2 px-3 py-3 text-left hover:bg-paper"
          @click="playAt(i)"
        >
          <span class="font-serif text-brand">{{ i + 1 }}</span>
          <span class="leading-snug">{{ t.title }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>
