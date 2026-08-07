<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listCategories } from '../api/mp3'
import type { MediaCategory } from '../types'

const cats = ref<MediaCategory[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    cats.value = await listCategories()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được album'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="w-full pb-28">
    <header class="mb-4">
      <h1 class="font-serif text-3xl font-bold tracking-tight">Pháp Âm</h1>
      <p class="mt-1 text-muted">Chọn album để nghe trên trình duyệt.</p>
    </header>

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <p v-else-if="error" class="text-red-800">{{ error }}</p>

    <ul
      v-else
      class="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <li v-for="c in cats" :key="c.id" class="min-h-0">
        <RouterLink
          class="flex h-full flex-col justify-start rounded-xl border border-black/10 bg-surface px-3 py-2.5 transition hover:border-brand/30 hover:shadow-sm"
          :to="`/mp3/${c.slug}`"
        >
          <strong class="line-clamp-2 font-serif text-[0.98rem] leading-snug font-semibold">
            {{ c.name }}
          </strong>
          <span class="mt-0.5 block h-4 overflow-hidden text-xs leading-4 text-muted">
            {{ c.description || '\u00A0' }}
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
