<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlayer } from '../stores/player'

const {
  state,
  current,
  progress,
  queueLabel,
  hasPrev,
  hasNext,
  toggle,
  next,
  prev,
  seekRatio,
  toggleShuffle,
  cycleRepeat,
  stopAndClose,
  formatTime,
} = usePlayer()

const scrub = ref(0)
const scrubbing = ref(false)

watch(progress, (p) => {
  if (!scrubbing.value) scrub.value = p
})

const seekBg = computed(() => {
  const pct = Math.round((scrubbing.value ? scrub.value : progress.value) * 1000) / 10
  return {
    background: `linear-gradient(to right, #8d6e63 0%, #8d6e63 ${pct}%, rgba(255,255,255,0.18) ${pct}%, rgba(255,255,255,0.18) 100%)`,
  }
})

const statusText = computed(() => {
  if (state.loading) return 'Đang tải…'
  if (state.error) return state.error
  if (state.playing) return queueLabel.value ? `Đang phát · ${queueLabel.value}` : 'Đang phát'
  return queueLabel.value ? `Tạm dừng · ${queueLabel.value}` : 'Tạm dừng'
})

function onScrubInput(e: Event) {
  scrubbing.value = true
  scrub.value = Number((e.target as HTMLInputElement).value)
}

function onScrubCommit() {
  seekRatio(scrub.value)
  scrubbing.value = false
}
</script>

<template>
  <div
    v-if="current"
    class="fixed right-3 bottom-[calc(4.2rem+env(safe-area-inset-bottom))] left-3 z-25 overflow-hidden rounded-2xl border border-white/10 bg-[#2a1810]/96 text-white shadow-2xl backdrop-blur-md lg:right-5 lg:bottom-5 lg:left-auto lg:w-[min(420px,calc(100vw-2.5rem))]"
    role="region"
    aria-label="Trình phát MP3"
  >
    <div class="flex items-start justify-between gap-2 px-3 pt-2.5">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-white">{{ current.title }}</p>
        <p class="truncate text-xs text-white/55">{{ statusText }}</p>
      </div>
      <button
        type="button"
        class="grid size-8 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
        title="Tắt trình phát"
        aria-label="Tắt trình phát"
        @click="stopAndClose"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <div class="px-3 pt-2">
      <input
        class="seek w-full"
        type="range"
        min="0"
        max="1"
        step="0.001"
        :value="scrub"
        :style="seekBg"
        :disabled="!state.duration || state.loading"
        aria-label="Tua bài"
        @input="onScrubInput"
        @change="onScrubCommit"
        @pointerup="onScrubCommit"
        @touchend="onScrubCommit"
      />
      <div class="mt-0.5 flex justify-between text-[0.68rem] text-white/55 tabular-nums">
        <span>{{ formatTime(scrubbing ? scrub * state.duration : state.position) }}</span>
        <span>{{ formatTime(state.duration) }}</span>
      </div>
    </div>

    <div class="flex items-center justify-center gap-1.5 px-3 pt-1 pb-3">
      <button
        type="button"
        class="grid size-8 place-items-center rounded-full text-sm font-bold"
        :class="state.shuffle ? 'bg-brand-soft/25 text-brand-soft' : 'text-white/40 hover:text-white/70'"
        title="Ngẫu nhiên"
        aria-label="Ngẫu nhiên"
        :aria-pressed="state.shuffle"
        @click="toggleShuffle"
      >
        ⇄
      </button>

      <button
        type="button"
        class="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-brand-soft disabled:opacity-35"
        aria-label="Bài trước"
        :disabled="!hasPrev"
        @click="prev"
      >
        ‹
      </button>

      <button
        type="button"
        class="grid size-11 place-items-center rounded-full bg-brand-soft text-ink shadow-md"
        :aria-label="state.playing ? 'Tạm dừng' : 'Phát'"
        @click="toggle"
      >
        <svg
          v-if="state.loading"
          class="animate-spin"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <svg v-else-if="state.playing" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5L8 5.5z" />
        </svg>
      </button>

      <button
        type="button"
        class="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-brand-soft disabled:opacity-35"
        aria-label="Bài sau"
        :disabled="!hasNext"
        @click="next"
      >
        ›
      </button>

      <button
        type="button"
        class="grid size-8 place-items-center rounded-full text-xs font-bold"
        :class="state.repeat !== 'off' ? 'bg-brand-soft/25 text-brand-soft' : 'text-white/40 hover:text-white/70'"
        :title="
          state.repeat === 'one' ? 'Lặp một bài' : state.repeat === 'all' ? 'Lặp danh sách' : 'Không lặp'
        "
        aria-label="Lặp lại"
        @click="cycleRepeat"
      >
        {{ state.repeat === 'one' ? '1' : state.repeat === 'all' ? '∞' : '–' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.seek {
  -webkit-appearance: none;
  appearance: none;
  height: 5px;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

.seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #c4a484;
  border: 0;
  box-shadow: 0 0 0 2px rgba(42, 24, 16, 0.55);
}

.seek::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #c4a484;
  border: 0;
}

.seek:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
