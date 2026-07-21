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
  <div class="w-full">
    <header class="mb-5">
      <h1 class="font-serif text-3xl font-bold tracking-tight text-ink">Thiền đường</h1>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="r in regions"
          :key="r.label"
          type="button"
          class="rounded-full border border-black/10 px-3.5 py-1.5 text-sm text-muted transition"
          :class="region === r.id ? 'border-transparent bg-brand font-semibold text-white' : 'bg-surface hover:border-brand/30'"
          @click="region = r.id"
        >
          {{ r.label }}
        </button>
      </div>
    </header>

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <p v-else-if="error" class="text-red-800">{{ error }}</p>

    <ul v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <li v-for="c in centers" :key="c.id">
        <RouterLink
          class="block h-full rounded-2xl border border-black/10 bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
          :to="`/thien-duong/${c.id}`"
        >
          <strong class="font-serif text-lg leading-snug font-semibold">{{ c.templeName }}</strong>
          <span class="mt-1.5 block text-sm text-muted">
            {{ [c.abbotRank, c.abbotName].filter(Boolean).join(' ') }}
            <template v-if="c.province"> · {{ c.province }}</template>
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
