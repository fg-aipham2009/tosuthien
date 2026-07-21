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

const items = computed(() => (mode.value === 'pdf' ? pdfs.value : texts.value))

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

function bookLink(b: BookPdf | TextBook) {
  return mode.value === 'pdf' ? `/kinh-sach/pdf/${b.id}` : `/kinh-sach/chu/${b.id}`
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
  <div class="w-full">
    <header
      class="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#2a1810] via-brand to-brand-soft px-5 py-5 text-white shadow-lg shadow-brand-deep/25 sm:px-7 lg:mb-6 lg:px-8 lg:py-6"
    >
      <div class="max-w-xl">
        <p class="mb-1 text-[0.72rem] font-semibold tracking-[0.1em] uppercase opacity-75">
          Thư viện
        </p>
        <h1 class="font-serif text-3xl font-bold tracking-tight lg:text-4xl">Kinh sách</h1>
        <p class="mt-2 text-[0.95rem] leading-relaxed opacity-90">{{ subtitle }}</p>
      </div>

      <div
        class="inline-grid min-w-[260px] grid-cols-2 gap-1 rounded-full bg-black/25 p-1"
        role="tablist"
        aria-label="Chế độ đọc"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'text'"
          class="rounded-full px-4 py-2.5 text-sm font-semibold transition"
          :class="mode === 'text' ? 'bg-surface text-brand' : 'text-white/80 hover:text-white'"
          @click="setMode('text')"
        >
          Đọc chữ
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'pdf'"
          class="rounded-full px-4 py-2.5 text-sm font-semibold transition"
          :class="mode === 'pdf' ? 'bg-surface text-brand' : 'text-white/80 hover:text-white'"
          @click="setMode('pdf')"
        >
          Bản gốc
        </button>
      </div>
    </header>

    <div v-if="!loading && !error" class="mb-4 flex items-center justify-between text-sm text-muted">
      <span>{{ listCount }} sách · {{ mode === 'text' ? 'Đọc chữ' : 'Bản gốc PDF' }}</span>
      <button
        type="button"
        class="font-semibold text-brand underline underline-offset-2"
        @click="reload"
      >
        Làm mới
      </button>
    </div>

    <p v-if="loading" class="py-10 text-center text-muted">Đang tải danh sách…</p>
    <p v-else-if="error" class="py-10 text-center text-red-800">{{ error }}</p>

    <ul
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
    >
      <li
        v-if="!items.length"
        class="col-span-full rounded-2xl border border-dashed border-black/15 px-4 py-10 text-center text-muted"
      >
        {{ mode === 'pdf' ? 'Chưa có PDF bản gốc.' : 'Chưa có sách đọc chữ.' }}
      </li>
      <li v-for="(b, i) in items" :key="b.id">
        <RouterLink class="group flex h-full flex-col gap-2.5" :to="bookLink(b)">
          <div
            class="relative flex aspect-[3/4.2] flex-col justify-between overflow-hidden rounded-2xl p-3 text-white shadow-md shadow-brand-deep/20 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-brand-deep/30"
            :style="b.coverImageUrl ? undefined : coverStyle(i)"
            aria-hidden="true"
          >
            <img
              v-if="b.coverImageUrl"
              :src="b.coverImageUrl"
              :alt="b.title"
              class="absolute inset-0 size-full object-cover"
            />
            <div
              class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,.45)_100%),radial-gradient(circle_at_20%_15%,rgba(255,255,255,.18),transparent_42%)]"
            />
            <span
              class="relative z-[1] w-fit rounded-full bg-white/15 px-2 py-0.5 text-[0.68rem] font-bold tracking-wider backdrop-blur-sm"
              :class="mode === 'text' ? 'font-serif text-[0.85rem] tracking-normal' : ''"
            >
              {{ mode === 'pdf' ? 'PDF' : 'Aa' }}
            </span>
            <span
              class="relative z-[1] line-clamp-4 font-serif text-[0.92rem] leading-snug font-semibold text-shadow-sm"
            >
              {{ b.title }}
            </span>
          </div>
          <div class="flex flex-col gap-0.5 px-0.5">
            <strong class="line-clamp-2 text-[0.9rem] leading-snug font-bold">{{ b.title }}</strong>
            <span v-if="b.lastPage" class="text-[0.78rem] font-semibold text-brand">
              Đọc dở · tr.{{ b.lastPage }}
            </span>
            <span v-else class="text-[0.78rem] text-muted">
              {{ b.pageCount ? `${b.pageCount} trang` : mode === 'pdf' ? 'PDF gốc' : 'Đọc chữ' }}
            </span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
