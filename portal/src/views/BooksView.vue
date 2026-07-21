<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listPdfs, listTextBooks } from '../api/books'
import type { BookPdf, TextBook } from '../types'

const mode = ref<'pdf' | 'text'>('pdf')
const pdfs = ref<BookPdf[]>([])
const texts = ref<TextBook[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    ;[pdfs.value, texts.value] = await Promise.all([listPdfs(), listTextBooks()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được kinh sách'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <header class="head">
      <h1>Kinh sách</h1>
      <div class="toggle">
        <button type="button" :class="{ on: mode === 'pdf' }" @click="mode = 'pdf'">
          Bản gốc (PDF)
        </button>
        <button type="button" :class="{ on: mode === 'text' }" @click="mode = 'text'">
          Đọc chữ
        </button>
      </div>
    </header>

    <p v-if="loading" class="muted">Đang tải…</p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <ul v-else-if="mode === 'pdf'" class="list">
      <li v-for="b in pdfs" :key="b.id">
        <RouterLink :to="`/kinh-sach/pdf/${b.id}`">
          <strong>{{ b.title }}</strong>
          <span v-if="b.lastPage">Đã đọc tới tr.{{ b.lastPage }}</span>
          <span v-else class="muted">{{ b.author || 'PDF' }}</span>
        </RouterLink>
      </li>
    </ul>

    <ul v-else class="list">
      <li v-for="b in texts" :key="b.id">
        <RouterLink :to="`/kinh-sach/chu/${b.id}`">
          <strong>{{ b.title }}</strong>
          <span v-if="b.lastPage">Đã đọc tới tr.{{ b.lastPage }}</span>
          <span v-else class="muted">{{ b.pageCount ? `${b.pageCount} trang` : 'Đọc chữ' }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.65rem;
}

.toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
}

.toggle button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}

.toggle .on {
  background: var(--gold);
  color: var(--ink);
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
  padding: 0.95rem 0.15rem;
}

.list strong {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.05rem;
}

.list span {
  font-size: 0.82rem;
  color: var(--gold-soft);
}

.muted {
  color: var(--muted);
}

.err {
  color: #e8a090;
}
</style>
