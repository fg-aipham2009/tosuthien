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
  <div>
    <RouterLink class="back" to="/mp3">← Album</RouterLink>
    <h1>{{ cat?.name || 'Album' }}</h1>
    <input v-model="q" class="search" type="search" placeholder="Tìm trong album…" />
    <p v-if="loading" class="muted">Đang tải…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else-if="!filtered.length" class="muted">Không có bài nào.</p>
    <ol v-else class="tracks">
      <li v-for="(t, i) in filtered" :key="t.id">
        <button type="button" @click="playAt(i)">
          <span class="n">{{ i + 1 }}</span>
          <span class="t">{{ t.title }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.back {
  color: var(--gold-soft);
  font-size: 0.9rem;
}

h1 {
  margin: 0.4rem 0 0.85rem;
  font-family: var(--font-display);
  font-size: 1.4rem;
}

.search {
  width: 100%;
  margin-bottom: 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--paper);
  padding: 0.6rem 0.8rem;
  font: inherit;
}

.tracks {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.tracks li {
  border-bottom: 1px solid var(--line);
}

.tracks button {
  width: 100%;
  display: grid;
  grid-template-columns: 2.2rem 1fr;
  gap: 0.5rem;
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.8rem 0.1rem;
  cursor: pointer;
  font: inherit;
}

.tracks button:hover .t {
  color: var(--gold-soft);
}

.n {
  color: var(--gold);
  font-family: var(--font-display);
}

.t {
  line-height: 1.35;
}

.muted {
  color: var(--muted);
}

.err {
  color: #e8a090;
}
</style>
