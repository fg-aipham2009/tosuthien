<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { listCenters } from '../api/centers'
import type { Center, CenterRegion } from '../types'

const regions: { id: CenterRegion | ''; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'NAM', label: 'Nam' },
  { id: 'TRUNG', label: 'Trung' },
  { id: 'BAC', label: 'Bắc' },
  { id: 'NUOC_NGOAI', label: 'Nước ngoài' },
]

const region = ref<CenterRegion | ''>('')
const centers = ref<Center[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    centers.value = await listCenters(region.value || undefined)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được danh sách'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(region, load)
</script>

<template>
  <div>
    <header class="head">
      <h1>Thiền đường</h1>
      <div class="chips">
        <button
          v-for="r in regions"
          :key="r.label"
          type="button"
          class="chip"
          :class="{ on: region === r.id }"
          @click="region = r.id"
        >
          {{ r.label }}
        </button>
      </div>
    </header>
    <p v-if="loading" class="muted">Đang tải…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else class="list">
      <li v-for="c in centers" :key="c.id">
        <RouterLink :to="`/thien-duong/${c.id}`">
          <strong>{{ c.templeName }}</strong>
          <span>
            {{ [c.abbotRank, c.abbotName].filter(Boolean).join(' ') }}
            <template v-if="c.province"> · {{ c.province }}</template>
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  margin-bottom: 1rem;
}

h1 {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: 1.65rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}

.chip.on {
  background: var(--gold);
  color: var(--ink);
  border-color: transparent;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.list li {
  border-bottom: 1px solid var(--line);
}

.list a {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.95rem 0.1rem;
}

.list strong {
  font-family: var(--font-display);
}

.list span {
  color: var(--muted);
  font-size: 0.85rem;
}

.muted {
  color: var(--muted);
}

.err {
  color: #e8a090;
}
</style>
