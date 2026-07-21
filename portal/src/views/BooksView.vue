<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { listPdfs, listTextBooks } from '../api/books'
import type { BookPdf, TextBook } from '../types'

type Mode = 'pdf' | 'text'

const route = useRoute()
const router = useRouter()

const mode = ref<Mode>(route.query.mode === 'text' ? 'text' : 'pdf')
const pdfs = ref<BookPdf[]>([])
const texts = ref<TextBook[]>([])
const loading = ref(true)
const error = ref('')

const subtitle = computed(() =>
  mode.value === 'pdf'
    ? 'PDF gốc — giữ đúng trang sách in, phóng to / tìm chữ.'
    : 'Đọc chữ — từng trang rõ ràng, chỉnh cỡ chữ, mở nhanh.',
)

const listCount = computed(() =>
  mode.value === 'pdf' ? pdfs.value.length : texts.value.length,
)

function setMode(next: Mode) {
  mode.value = next
  void router.replace({ query: next === 'pdf' ? {} : { mode: 'text' } })
}

async function reload() {
  loading.value = true
  error.value = ''
  try {
    ;[pdfs.value, texts.value] = await Promise.all([listPdfs(), listTextBooks()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được kinh sách'
  } finally {
    loading.value = false
  }
}

onMounted(reload)

watch(
  () => route.query.mode,
  (m) => {
    mode.value = m === 'text' ? 'text' : 'pdf'
  },
)
</script>

<template>
  <div class="books">
    <header class="hero">
      <p class="eyebrow">Thư viện</p>
      <h1>Kinh sách</h1>
      <p class="sub">{{ subtitle }}</p>
    </header>

    <div class="seg" role="tablist" aria-label="Chế độ đọc">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'pdf'"
        class="seg-btn"
        :class="{ on: mode === 'pdf' }"
        @click="setMode('pdf')"
      >
        <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            stroke-width="1.75"
          />
          <path d="M14 3v5h5" stroke="currentColor" stroke-width="1.75" />
        </svg>
        Bản gốc
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'text'"
        class="seg-btn"
        :class="{ on: mode === 'text' }"
        @click="setMode('text')"
      >
        <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 5h7a3 3 0 0 1 3 3v12H7a3 3 0 0 0-3 3V5Z"
            stroke="currentColor"
            stroke-width="1.75"
          />
          <path
            d="M20 5h-7a3 3 0 0 0-3 3v12h7a3 3 0 0 1 3 3V5Z"
            stroke="currentColor"
            stroke-width="1.75"
          />
        </svg>
        Đọc chữ
      </button>
    </div>

    <div class="meta-row" v-if="!loading && !error">
      <span>{{ listCount }} sách</span>
      <button type="button" class="refresh" @click="reload">Làm mới</button>
    </div>

    <p v-if="loading" class="state">Đang tải danh sách…</p>
    <p v-else-if="error" class="state err">{{ error }}</p>

    <ul v-else-if="mode === 'pdf'" class="grid">
      <li v-if="!pdfs.length" class="empty">Chưa có PDF bản gốc.</li>
      <li v-for="b in pdfs" :key="b.id">
        <RouterLink class="card" :to="`/kinh-sach/pdf/${b.id}`">
          <div class="cover pdf" aria-hidden="true">
            <span>PDF</span>
          </div>
          <div class="body">
            <strong>{{ b.title }}</strong>
            <span class="author">{{ b.author || 'Hòa thượng Thích Duy Lực' }}</span>
            <span v-if="b.lastPage" class="progress">Đọc dở · tr.{{ b.lastPage }}</span>
            <span v-else-if="b.pageCount" class="pages">{{ b.pageCount }} trang</span>
          </div>
          <span class="chev" aria-hidden="true">›</span>
        </RouterLink>
      </li>
    </ul>

    <ul v-else class="grid">
      <li v-if="!texts.length" class="empty">Chưa có sách đọc chữ.</li>
      <li v-for="b in texts" :key="b.id">
        <RouterLink class="card" :to="`/kinh-sach/chu/${b.id}`">
          <div class="cover text" aria-hidden="true">
            <span>Aa</span>
          </div>
          <div class="body">
            <strong>{{ b.title }}</strong>
            <span class="author">{{ b.author || 'Hòa thượng Thích Duy Lực' }}</span>
            <span v-if="b.lastPage" class="progress">Đọc dở · tr.{{ b.lastPage }}</span>
            <span v-else-if="b.pageCount" class="pages">{{ b.pageCount }} trang</span>
          </div>
          <span class="chev" aria-hidden="true">›</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.books {
  --ink: #1d1b1a;
  --muted: #605d5c;
  --line: rgba(154, 142, 138, 0.35);
  --surface: #fffbff;
  --primary: #5d4037;
  max-width: 720px;
  margin: 0 auto;
}

.hero {
  margin: 0 0 1rem;
  padding: 1.25rem 1.35rem;
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(135deg, #3e2723 0%, #6d4c41 100%);
  box-shadow: 0 10px 28px rgba(62, 39, 35, 0.22);
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  font-weight: 600;
}

h1 {
  margin: 0;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: clamp(1.55rem, 4vw, 1.9rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.sub {
  margin: 0.45rem 0 0;
  font-size: 0.92rem;
  line-height: 1.45;
  opacity: 0.92;
}

.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  padding: 0.3rem;
  margin-bottom: 0.85rem;
  background: #ebe4e1;
  border-radius: 14px;
}

.seg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 0;
  border-radius: 11px;
  padding: 0.7rem 0.75rem;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.seg-btn.on {
  background: var(--surface);
  color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ico {
  flex-shrink: 0;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.65rem;
  font-size: 0.82rem;
  color: var(--muted);
}

.refresh {
  border: 0;
  background: transparent;
  color: var(--primary);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.state {
  margin: 1.5rem 0;
  text-align: center;
  color: var(--muted);
}

.state.err {
  color: #93000a;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--muted);
  border: 1px dashed var(--line);
  border-radius: 14px;
}

.card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 0.95rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.card:hover {
  border-color: rgba(93, 64, 55, 0.35);
  box-shadow: 0 6px 18px rgba(62, 39, 35, 0.08);
  transform: translateY(-1px);
}

.cover {
  width: 52px;
  height: 68px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.cover.pdf {
  background: linear-gradient(160deg, #d7ccc8, #5d4037);
}

.cover.text {
  background: linear-gradient(160deg, #8d6e63, #5d4037);
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 1.05rem;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.body strong {
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.author,
.pages {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress {
  font-size: 0.78rem;
  color: var(--primary);
  font-weight: 650;
}

.chev {
  color: var(--muted);
  font-size: 1.35rem;
  flex-shrink: 0;
}
</style>
