<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { fetchTextPages, listPdfs, listTextBooks, saveReadingProgress } from '../api/books'
import type { TextBook, TextBookPage } from '../types'

const route = useRoute()
const book = ref<TextBook | null>(null)
const pages = ref<TextBookPage[]>([])
const pageCount = ref(0)
/** Lowest page the reader may show (after skipping leading blank front-matter). */
const firstContentPage = ref(1)
const page = ref(1)
const loading = ref(true)
const error = ref('')
const pdfId = ref<string | null>(null)
const fontScale = ref(1.12)

const current = computed(() => pages.value.find((p) => p.page === page.value))

/** Reflow OCR soft line-breaks so text fills the reading width. */
const displayText = computed(() => {
  const raw =
    current.value?.text ||
    (current.value?.isBlank ? '(Trang trống)' : 'Không có nội dung')
  return raw
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n+/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
})

function isContentPage(p?: TextBookPage | null) {
  return !!p && !p.isBlank && p.text.trim().length > 0
}

function clampToContent(n: number) {
  const max = pageCount.value || Number.POSITIVE_INFINITY
  return Math.min(max, Math.max(firstContentPage.value, n))
}

async function loadWindow(center: number) {
  const from = Math.max(1, center - 5)
  const to = center + 14
  const data = await fetchTextPages(String(route.params.id), from, to)
  pageCount.value = data.pageCount
  book.value = {
    ...(book.value as TextBook),
    title: data.title,
    pageCount: data.pageCount,
  }
  const map = new Map(pages.value.map((p) => [p.page, p]))
  for (const p of data.pages) map.set(p.page, p)
  pages.value = [...map.values()].sort((a, b) => a.page - b.page)
}

async function resolveFirstContentPage(hintBlank: number): Promise<number> {
  const hint = Math.max(1, hintBlank + 1)
  const probeTo = Math.min(pageCount.value || hint + 20, hint + 24)
  await loadWindow(hint)
  const hit = pages.value.find((p) => p.page >= hint && isContentPage(p))
  if (hit) return hit.page

  const data = await fetchTextPages(String(route.params.id), 1, probeTo)
  pageCount.value = data.pageCount
  for (const p of data.pages) {
    const i = pages.value.findIndex((x) => x.page === p.page)
    if (i >= 0) pages.value[i] = p
    else pages.value.push(p)
  }
  pages.value.sort((a, b) => a.page - b.page)
  const first = data.pages.find((p) => isContentPage(p))
  return first?.page ?? hint
}

function prev() {
  page.value = clampToContent(page.value - 1)
}

function next() {
  page.value = clampToContent(page.value + 1)
}

onMounted(async () => {
  try {
    const [texts, pdfs] = await Promise.all([listTextBooks(), listPdfs()])
    book.value = texts.find((b) => b.id === route.params.id) ?? null
    if (!book.value) {
      error.value = 'Không tìm thấy sách chữ'
      return
    }

    pageCount.value = book.value.pageCount || 0
    firstContentPage.value = await resolveFirstContentPage(book.value.blankPages ?? 0)

    const saved = book.value.lastPage || 0
    page.value = saved >= firstContentPage.value ? saved : firstContentPage.value

    const stem = String(route.params.id)
    pdfId.value =
      pdfs.find((p) => p.slug === stem || p.filename?.replace(/\.pdf$/i, '') === stem)?.id ?? null

    if (!pages.value.some((p) => p.page === page.value)) {
      await loadWindow(page.value)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lỗi tải trang'
  } finally {
    loading.value = false
  }
})

watch(page, async (p) => {
  const nextPage = clampToContent(p)
  if (nextPage !== p) {
    page.value = nextPage
    return
  }
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
  <div class="-mx-4 flex min-h-full w-[calc(100%+2rem)] flex-col sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)] xl:-mx-10 xl:w-[calc(100%+5rem)]">
    <div class="flex flex-wrap items-center gap-3 border-b border-black/10 bg-surface px-4 py-3 sm:px-6 lg:px-8">
      <RouterLink class="text-sm font-semibold text-brand" to="/kinh-sach">← Đọc chữ</RouterLink>
      <div class="min-w-0 flex-1">
        <h1 class="truncate font-serif text-base font-bold sm:text-lg">
          {{ book?.title || 'Đọc chữ' }}
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-40"
          :disabled="page <= firstContentPage"
          @click="prev"
        >
          Trước
        </button>
        <span class="min-w-16 text-center text-sm font-semibold">{{ page }} / {{ pageCount || '…' }}</span>
        <button
          type="button"
          class="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-40"
          :disabled="pageCount > 0 && page >= pageCount"
          @click="next"
        >
          Sau
        </button>
        <button
          type="button"
          class="size-8 rounded-lg border border-black/10 bg-white font-bold text-brand"
          title="Thu nhỏ"
          @click="fontScale = Math.max(0.95, fontScale - 0.08)"
        >
          A−
        </button>
        <button
          type="button"
          class="size-8 rounded-lg border border-black/10 bg-white font-bold text-brand"
          title="Phóng to"
          @click="fontScale = Math.min(1.55, fontScale + 0.08)"
        >
          A+
        </button>
      </div>
    </div>

    <p v-if="error" class="px-4 pt-3 text-red-800 sm:px-6 lg:px-8">{{ error }}</p>
    <p v-if="loading" class="px-4 py-8 text-muted sm:px-6 lg:px-8">Đang tải…</p>

    <article
      v-else
      class="min-h-[70vh] flex-1 bg-gradient-to-b from-[#fffdf9] to-[#f3ebe3] px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 xl:px-16"
      :style="{ fontSize: `${fontScale}rem` }"
    >
      <div
        class="mx-auto w-full max-w-none font-serif leading-[1.85] break-words whitespace-pre-wrap text-[#2a211c]"
      >
        {{ displayText }}
      </div>
    </article>
  </div>
</template>
