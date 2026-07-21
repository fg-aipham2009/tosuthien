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

onMounted(async () => {
  try {
    const [texts, pdfs] = await Promise.all([listTextBooks(), listPdfs()])
    book.value = texts.find((b) => b.id === route.params.id) ?? null
    if (!book.value) {
      error.value = 'Không tìm thấy sách chữ'
      return
    }
    page.value = book.value.lastPage || 1
    // Match PDF by slug/filename stem for progress
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
  <div class="wrap">
    <RouterLink class="back" to="/kinh-sach">← Kinh sách</RouterLink>
    <h1>{{ book?.title || 'Đọc chữ' }}</h1>
    <p v-if="error" class="err">{{ error }}</p>
    <div class="toolbar">
      <button type="button" :disabled="page <= 1" @click="page--">Trước</button>
      <span>{{ page }} / {{ pageCount || '…' }}</span>
      <button type="button" :disabled="pageCount > 0 && page >= pageCount" @click="page++">
        Sau
      </button>
    </div>
    <p v-if="loading" class="muted">Đang tải…</p>
    <article v-else class="page">
      <pre>{{ current?.text || (current?.isBlank ? '(Trang trống)' : 'Không có nội dung') }}</pre>
    </article>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.back {
  color: var(--gold-soft);
  font-size: 0.9rem;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.toolbar button {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--gold-soft);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  font: inherit;
}

.page {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 1.25rem;
  background:
    linear-gradient(180deg, rgba(243, 235, 224, 0.08), rgba(243, 235, 224, 0.03)),
    rgba(0, 0, 0, 0.2);
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-display);
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--paper);
}

.muted {
  color: var(--muted);
}

.err {
  color: #e8a090;
}
</style>
