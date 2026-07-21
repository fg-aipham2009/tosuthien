<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { listPdfs, saveReadingProgress } from '../api/books'
import type { BookPdf } from '../types'

const route = useRoute()
const book = ref<BookPdf | null>(null)
const page = ref(1)
const error = ref('')
const loading = ref(true)

const src = computed(() => {
  if (!book.value?.publicUrl) return ''
  return `${book.value.publicUrl}#page=${page.value}`
})

const maxPage = computed(() => book.value?.pageCount || null)

function clampPage(n: number) {
  const max = maxPage.value
  if (max && n > max) return max
  return Math.max(1, n)
}

function prev() {
  page.value = clampPage(page.value - 1)
}

function next() {
  page.value = clampPage(page.value + 1)
}

onMounted(async () => {
  try {
    const all = await listPdfs()
    book.value = all.find((b) => b.id === route.params.id) ?? null
    if (!book.value) error.value = 'Không tìm thấy sách'
    else page.value = book.value.lastPage || 1
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lỗi tải PDF'
  } finally {
    loading.value = false
  }
})

watch(page, (p) => {
  if (book.value) void saveReadingProgress(book.value.id, p).catch(() => {})
})
</script>

<template>
  <div class="flex min-h-[70vh] w-full flex-col gap-3">
    <div class="flex items-center justify-between">
      <RouterLink class="text-sm font-semibold text-brand" to="/kinh-sach?mode=pdf">
        ← Bản gốc
      </RouterLink>
      <span class="rounded-full bg-[#efe6df] px-2.5 py-1 text-[0.72rem] font-bold tracking-wider text-brand">
        PDF
      </span>
    </div>

    <h1 class="font-serif text-2xl leading-snug font-bold lg:text-3xl">
      {{ book?.title || 'Đọc PDF' }}
    </h1>
    <p v-if="book?.author" class="text-sm text-muted">{{ book.author }}</p>

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <p v-else-if="error" class="text-red-800">{{ error }}</p>

    <template v-else-if="book">
      <div
        class="flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-surface px-3 py-2.5"
      >
        <button
          type="button"
          class="rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-brand disabled:opacity-40"
          :disabled="page <= 1"
          @click="prev"
        >
          Trước
        </button>
        <label class="inline-flex items-center gap-2 text-sm text-muted">
          Trang
          <input
            class="w-16 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-ink"
            :value="page"
            type="number"
            min="1"
            :max="maxPage || undefined"
            @change="page = clampPage(Number(($event.target as HTMLInputElement).value) || 1)"
          />
          <span v-if="maxPage">/ {{ maxPage }}</span>
        </label>
        <button
          type="button"
          class="rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-brand disabled:opacity-40"
          :disabled="!!maxPage && page >= maxPage"
          @click="next"
        >
          Sau
        </button>
        <a
          class="rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-brand"
          :href="book.publicUrl"
          target="_blank"
          rel="noopener"
        >
          Mở tab mới
        </a>
      </div>

      <div
        class="min-h-[72vh] flex-1 overflow-hidden rounded-2xl border border-black/10 bg-[#2a1810] shadow-lg shadow-brand-deep/15"
      >
        <iframe v-if="src" class="h-full min-h-[72vh] w-full border-0 bg-black" :src="src" title="PDF reader" />
      </div>
    </template>
  </div>
</template>
