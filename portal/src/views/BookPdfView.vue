<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { listPdfs, saveReadingProgress } from '../api/books'
import type { BookPdf } from '../types'

const route = useRoute()
const book = ref<BookPdf | null>(null)
const page = ref(1)
const error = ref('')

const src = computed(() => {
  if (!book.value?.publicUrl) return ''
  return `${book.value.publicUrl}#page=${page.value}`
})

onMounted(async () => {
  try {
    const all = await listPdfs()
    book.value = all.find((b) => b.id === route.params.id) ?? null
    if (!book.value) error.value = 'Không tìm thấy sách'
    else page.value = book.value.lastPage || 1
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lỗi tải PDF'
  }
})

watch(page, (p) => {
  if (book.value) void saveReadingProgress(book.value.id, p).catch(() => {})
})
</script>

<template>
  <div class="wrap">
    <RouterLink class="back" to="/kinh-sach">← Kinh sách</RouterLink>
    <h1>{{ book?.title || 'Đọc PDF' }}</h1>
    <p v-if="error" class="err">{{ error }}</p>
    <div v-if="book" class="toolbar">
      <button type="button" :disabled="page <= 1" @click="page--">Trang trước</button>
      <label>
        Trang
        <input v-model.number="page" type="number" min="1" />
      </label>
      <button type="button" @click="page++">Trang sau</button>
      <a :href="book.publicUrl" target="_blank" rel="noopener">Mở tab mới</a>
    </div>
    <iframe v-if="src" class="frame" :src="src" title="PDF reader" />
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-height: 70vh;
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
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.toolbar button,
.toolbar a,
.toolbar input {
  font: inherit;
}

.toolbar button,
.toolbar a {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--gold-soft);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  text-decoration: none;
  cursor: pointer;
}

.toolbar input {
  width: 4.5rem;
  margin-left: 0.35rem;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.25);
  color: var(--paper);
  padding: 0.25rem 0.4rem;
}

.frame {
  flex: 1;
  width: 100%;
  min-height: 70vh;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #111;
}

.err {
  color: #e8a090;
}
</style>
