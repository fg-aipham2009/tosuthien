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
  <div class="reader">
    <div class="top">
      <RouterLink class="back" to="/kinh-sach?mode=pdf">← Bản gốc</RouterLink>
      <span class="badge">PDF</span>
    </div>

    <h1>{{ book?.title || 'Đọc PDF' }}</h1>
    <p v-if="book?.author" class="author">{{ book.author }}</p>

    <p v-if="loading" class="state">Đang tải…</p>
    <p v-else-if="error" class="state err">{{ error }}</p>

    <template v-else-if="book">
      <div class="toolbar">
        <button type="button" :disabled="page <= 1" @click="prev">Trước</button>
        <label class="page-field">
          Trang
          <input
            :value="page"
            type="number"
            min="1"
            :max="maxPage || undefined"
            @change="page = clampPage(Number(($event.target as HTMLInputElement).value) || 1)"
          />
          <span v-if="maxPage" class="of">/ {{ maxPage }}</span>
        </label>
        <button type="button" :disabled="!!maxPage && page >= maxPage" @click="next">Sau</button>
        <a class="open" :href="book.publicUrl" target="_blank" rel="noopener">Mở tab mới</a>
      </div>

      <div class="frame-wrap">
        <iframe v-if="src" class="frame" :src="src" title="PDF reader" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.reader {
  --primary: #5d4037;
  --muted: #605d5c;
  --line: rgba(154, 142, 138, 0.35);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-height: 70vh;
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
  color: #1d1b1a;
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

.toolbar button,
.open {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--primary);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
}

.toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.88rem;
  color: var(--muted);
}

.page-field input {
  width: 4rem;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #fff;
  color: #1d1b1a;
  padding: 0.3rem 0.4rem;
}

.of {
  color: var(--muted);
}

.frame-wrap {
  flex: 1;
  min-height: 68vh;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: #2a1810;
  box-shadow: 0 10px 28px rgba(42, 24, 16, 0.12);
}

.frame {
  width: 100%;
  height: 100%;
  min-height: 68vh;
  border: 0;
  background: #111;
}

.state {
  color: var(--muted);
}

.state.err {
  color: #93000a;
}
</style>
