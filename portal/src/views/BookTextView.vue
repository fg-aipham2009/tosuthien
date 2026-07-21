<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { fetchTextPages, listPdfs, listTextBooks, saveReadingProgress } from '../api/books'
import type { TextBook, TextBookPage } from '../types'

const route = useRoute()
const book = ref<TextBook | null>(null)
const pages = ref<TextBookPage[]>([])
const pageCount = ref(0)
const page = ref(1)
const loading = ref(true)
const error = ref('')
const pdfId = ref<string | null>(null)
const fontScale = ref(1.05)

const current = computed(() => pages.value.find((p) => p.page === page.value))

async function loadWindow(center: number) {
  const from = Math.max(1, center - 5)
  const to = center + 14
  const data = await fetchTextPages(String(route.params.id), from, to)
  pageCount.value = data.pageCount
  book.value = { ...(book.value as TextBook), title: data.title, pageCount: data.pageCount }
  const map = new Map(pages.value.map((p) => [p.page, p]))
  for (const p of data.pages) map.set(p.page, p)
  pages.value = [...map.values()].sort((a, b) => a.page - b.page)
}

function prev() {
  if (page.value > 1) page.value -= 1
}

function next() {
  if (!pageCount.value || page.value < pageCount.value) page.value += 1
}

onMounted(async () => {
  try {
    const [texts, pdfs] = await Promise.all([listTextBooks(), listPdfs()])
    book.value = texts.find((b) => b.id === route.params.id) ?? null
    if (!book.value) {
      error.value = 'Không tìm thấy sách chữ'
      return
    }
    page.value = book.value.lastPage || 1
    const stem = String(route.params.id)
    pdfId.value =
      pdfs.find((p) => p.slug === stem || p.filename?.replace(/\.pdf$/i, '') === stem)?.id ?? null
    await loadWindow(page.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lỗi tải trang'
  } finally {
    loading.value = false
  }
})

watch(page, async (p) => {
  if (!pages.value.some((x) => x.page === p)) {
    loading.value = true
    try {
      await loadWindow(p)
    } finally {
      loading.value = false
    }
  }
  if (pdfId.value) void saveReadingProgress(pdfId.value, p).catch(() => {})
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 lg:max-w-6xl xl:max-w-7xl">
    <div class="flex items-center justify-between">
      <RouterLink class="text-sm font-semibold text-brand" to="/kinh-sach">← Đọc chữ</RouterLink>
      <span class="rounded-full bg-[#efe6df] px-2.5 py-1 text-[0.72rem] font-bold tracking-wider text-brand">
        Chữ
      </span>
    </div>

    <h1 class="font-serif text-2xl leading-snug font-bold lg:text-3xl">
      {{ book?.title || 'Đọc chữ' }}
    </h1>
    <p v-if="book?.author" class="text-sm text-muted">{{ book.author }}</p>
    <p v-if="error" class="text-red-800">{{ error }}</p>

    <div
      class="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-surface/95 px-3 py-2.5 backdrop-blur"
    >
      <button
        type="button"
        class="rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-brand disabled:opacity-40"
        :disabled="page <= 1"
        @click="prev"
      >
        Trước
      </button>
      <span class="min-w-16 text-center text-sm font-semibold">{{ page }} / {{ pageCount || '…' }}</span>
      <button
        type="button"
        class="rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-brand disabled:opacity-40"
        :disabled="pageCount > 0 && page >= pageCount"
        @click="next"
      >
        Sau
      </button>
      <div class="ml-auto flex gap-1.5">
        <button
          type="button"
          class="size-9 rounded-lg border border-black/10 bg-white font-bold text-brand"
          title="Thu nhỏ"
          @click="fontScale = Math.max(0.9, fontScale - 0.08)"
        >
          A−
        </button>
        <button
          type="button"
          class="size-9 rounded-lg border border-black/10 bg-white font-bold text-brand"
          title="Phóng to"
          @click="fontScale = Math.min(1.5, fontScale + 0.08)"
        >
          A+
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <article
      v-else
      class="rounded-2xl border border-black/10 bg-gradient-to-b from-[#fffdf9] to-[#f7f0e8] px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-12 lg:py-10"
      :style="{ fontSize: `${fontScale}rem` }"
    >
      <pre
        class="m-0 font-serif text-[1.08em] leading-[1.8] break-words whitespace-pre-wrap text-[#2a211c]"
      >{{ current?.text || (current?.isBlank ? '(Trang trống)' : 'Không có nội dung') }}</pre>
    </article>
  </div>
</template>
