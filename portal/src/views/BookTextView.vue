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
const fontScale = ref(1)

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
  <div class="reader">
    <div class="top">
      <RouterLink class="back" to="/kinh-sach?mode=text">← Đọc chữ</RouterLink>
      <span class="badge">Chữ</span>
    </div>

    <h1>{{ book?.title || 'Đọc chữ' }}</h1>
    <p v-if="book?.author" class="author">{{ book.author }}</p>
    <p v-if="error" class="state err">{{ error }}</p>

    <div class="toolbar">
      <button type="button" :disabled="page <= 1" @click="prev">Trước</button>
      <span class="page-label">{{ page }} / {{ pageCount || '…' }}</span>
      <button type="button" :disabled="pageCount > 0 && page >= pageCount" @click="next">Sau</button>
      <div class="font-tools">
        <button type="button" title="Thu nhỏ" @click="fontScale = Math.max(0.85, fontScale - 0.1)">
          A−
        </button>
        <button type="button" title="Phóng to" @click="fontScale = Math.min(1.45, fontScale + 0.1)">
          A+
        </button>
      </div>
    </div>

    <p v-if="loading" class="state">Đang tải…</p>
    <article v-else class="page" :style="{ fontSize: `${fontScale}rem` }">
      <pre>{{ current?.text || (current?.isBlank ? '(Trang trống)' : 'Không có nội dung') }}</pre>
    </article>
  </div>
</template>

<style scoped>
.reader {
  --primary: #5d4037;
  --muted: #605d5c;
  --line: rgba(154, 142, 138, 0.35);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  max-width: 720px;
  margin: 0 auto;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back {
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.badge {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: #efe6df;
  color: var(--primary);
}

h1 {
  margin: 0;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: clamp(1.25rem, 3vw, 1.55rem);
  line-height: 1.3;
}

.author {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  background: #fffbff;
  border: 1px solid var(--line);
  border-radius: 14px;
}

.toolbar > button {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--primary);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
}

.toolbar > button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1d1b1a;
  min-width: 4.5rem;
  text-align: center;
}

.font-tools {
  margin-left: auto;
  display: flex;
  gap: 0.35rem;
}

.font-tools button {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--primary);
  border-radius: 8px;
  width: 2.2rem;
  height: 2.2rem;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.page {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: clamp(1.1rem, 3vw, 1.75rem);
  background:
    linear-gradient(180deg, #fffdf9 0%, #f7f0e8 100%);
  box-shadow: 0 8px 24px rgba(62, 39, 35, 0.06);
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  font-size: 1.08em;
  line-height: 1.75;
  color: #2a211c;
}

.state {
  color: var(--muted);
}

.state.err {
  color: #93000a;
}
</style>
