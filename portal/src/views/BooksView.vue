<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { listPdfs, listTextBooks } from '../api/books'
import type { BookPdf, TextBook } from '../types'

type Mode = 'pdf' | 'text'

const route = useRoute()
const router = useRouter()

const mode = ref<Mode>(route.query.mode === 'pdf' ? 'pdf' : 'text')
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

/** Soft cover hues so the grid feels alive without looking random. */
function coverStyle(index: number) {
  const hue = [18, 28, 8, 35, 14, 22, 12, 30][index % 8]
  return {
    background: `linear-gradient(155deg, hsl(${hue} 32% 42%) 0%, hsl(${hue} 38% 22%) 100%)`,
  }
}

function setMode(next: Mode) {
  mode.value = next
  void router.replace({ query: next === 'text' ? {} : { mode: 'pdf' } })
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
    mode.value = m === 'pdf' ? 'pdf' : 'text'
  },
)
</script>

<template>
  <div class="books">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Thư viện</p>
        <h1>Kinh sách</h1>
        <p class="sub">{{ subtitle }}</p>
      </div>
      <div class="seg" role="tablist" aria-label="Chế độ đọc">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'text'"
          class="seg-btn"
          :class="{ on: mode === 'text' }"
          @click="setMode('text')"
        >
          Đọc chữ
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'pdf'"
          class="seg-btn"
          :class="{ on: mode === 'pdf' }"
          @click="setMode('pdf')"
        >
          Bản gốc
        </button>
      </div>
    </header>

    <div class="meta-row" v-if="!loading && !error">
      <span>{{ listCount }} sách · {{ mode === 'text' ? 'Đọc chữ' : 'Bản gốc PDF' }}</span>
      <button type="button" class="refresh" @click="reload">Làm mới</button>
    </div>

    <p v-if="loading" class="state">Đang tải danh sách…</p>
    <p v-else-if="error" class="state err">{{ error }}</p>

    <ul v-else-if="mode === 'pdf'" class="grid">
      <li v-if="!pdfs.length" class="empty">Chưa có PDF bản gốc.</li>
      <li v-for="(b, i) in pdfs" :key="b.id">
        <RouterLink class="card" :to="`/kinh-sach/pdf/${b.id}`">
          <div class="cover" :style="coverStyle(i)" aria-hidden="true">
            <span class="cover-mark">PDF</span>
            <span class="cover-title">{{ b.title }}</span>
          </div>
          <div class="meta">
            <strong>{{ b.title }}</strong>
            <span v-if="b.lastPage" class="progress">Đọc dở · tr.{{ b.lastPage }}</span>
            <span v-else class="pages">{{ b.pageCount ? `${b.pageCount} trang` : 'PDF gốc' }}</span>
          </div>
        </RouterLink>
      </li>
    </ul>

    <ul v-else class="grid">
      <li v-if="!texts.length" class="empty">Chưa có sách đọc chữ.</li>
      <li v-for="(b, i) in texts" :key="b.id">
        <RouterLink class="card" :to="`/kinh-sach/chu/${b.id}`">
          <div class="cover text" :style="coverStyle(i)" aria-hidden="true">
            <span class="cover-mark">Aa</span>
            <span class="cover-title">{{ b.title }}</span>
          </div>
          <div class="meta">
            <strong>{{ b.title }}</strong>
            <span v-if="b.lastPage" class="progress">Đọc dở · tr.{{ b.lastPage }}</span>
            <span v-else class="pages">{{ b.pageCount ? `${b.pageCount} trang` : 'Đọc chữ' }}</span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.books {
  --muted: #605d5c;
  --line: rgba(154, 142, 138, 0.35);
  --surface: #fffbff;
  --primary: #5d4037;
  width: 100%;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 1rem 1.5rem;
  margin: 0 0 1.15rem;
  padding: 1.35rem clamp(1.1rem, 2.5vw, 1.75rem);
  border-radius: 18px;
  color: #fff;
  background:
    radial-gradient(1200px 280px at 90% -20%, rgba(255, 255, 255, 0.16), transparent 55%),
    linear-gradient(125deg, #2a1810 0%, #5d4037 48%, #8d6e63 100%);
  box-shadow: 0 14px 36px rgba(42, 24, 16, 0.22);
}

.eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.72;
  font-weight: 650;
}

h1 {
  margin: 0;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: clamp(1.7rem, 4vw, 2.15rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.sub {
  margin: 0.4rem 0 0;
  font-size: 0.95rem;
  line-height: 1.45;
  opacity: 0.9;
  max-width: 34rem;
}

.seg {
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
  padding: 0.28rem;
  background: rgba(0, 0, 0, 0.22);
  border-radius: 999px;
  min-width: min(100%, 280px);
}

.seg-btn {
  border: 0;
  border-radius: 999px;
  padding: 0.55rem 1rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.seg-btn.on {
  background: #fffbff;
  color: var(--primary);
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.9rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.refresh {
  border: 0;
  background: transparent;
  color: var(--primary);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 650;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.state {
  margin: 2rem 0;
  text-align: center;
  color: var(--muted);
}

.state.err {
  color: #93000a;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0 0 1.25rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 1rem 0.85rem;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 1.2rem 1rem;
  }
}

@media (min-width: 1100px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--muted);
  border: 1px dashed var(--line);
  border-radius: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  height: 100%;
  transition: transform 0.18s ease;
}

.card:hover {
  transform: translateY(-4px);
}

.cover {
  position: relative;
  aspect-ratio: 3 / 4.2;
  border-radius: 14px;
  overflow: hidden;
  padding: 0.85rem 0.75rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.12) inset,
    0 12px 28px rgba(42, 24, 16, 0.18);
  transition: box-shadow 0.18s ease;
}

.card:hover .cover {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.16) inset,
    0 18px 34px rgba(42, 24, 16, 0.26);
}

.cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.45) 100%),
    radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.18), transparent 42%);
  pointer-events: none;
}

.cover-mark {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  padding: 0.22rem 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(4px);
}

.cover.text .cover-mark {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 0.85rem;
  letter-spacing: 0;
}

.cover-title {
  position: relative;
  z-index: 1;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0 0.1rem;
}

.meta strong {
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pages {
  font-size: 0.78rem;
  color: var(--muted);
}

.progress {
  font-size: 0.78rem;
  color: var(--primary);
  font-weight: 650;
}
</style>
