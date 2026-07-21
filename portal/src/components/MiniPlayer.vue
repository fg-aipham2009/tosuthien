<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlayer } from '../stores/player'

const {
  state,
  current,
  progress,
  hasPrev,
  hasNext,
  toggle,
  next,
  prev,
  seekRatio,
  toggleShuffle,
  cycleRepeat,
  setExpanded,
  formatTime,
} = usePlayer()

const scrub = ref(0)
const scrubbing = ref(false)

watch(progress, (p) => {
  if (!scrubbing.value) scrub.value = p
})

const repeatLabel = computed(() => {
  if (state.repeat === 'one') return '1'
  if (state.repeat === 'all') return '∞'
  return '–'
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
  >
    <!-- Progress -->
    <div class="px-3 pt-2">
      <input
        class="seek w-full"
        type="range"
        min="0"
        max="1"
        step="0.001"
        :value="scrub"
        :disabled="!state.duration"
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

    <div class="flex items-center gap-3 px-3.5 pt-1 pb-2.5">
      <button class="min-w-0 flex-1 p-0 text-left" type="button" @click="setExpanded(!state.expanded)">
        <span class="block truncate text-sm font-medium text-white">{{ current.title }}</span>
        <span class="text-xs text-white/60">
          <template v-if="state.loading">Đang tải…</template>
          <template v-else-if="state.error">{{ state.error }}</template>
          <template v-else>{{ state.playing ? 'Đang phát' : 'Tạm dừng' }}</template>
        </span>
      </button>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="hidden size-8 rounded-full text-xs font-bold sm:grid sm:place-items-center"
          :class="state.shuffle ? 'bg-brand-soft/30 text-brand-soft' : 'text-white/45'"
          title="Ngẫu nhiên"
          @click="toggleShuffle"
        >
          ⇄
        </button>
        <button
          type="button"
          class="size-8 rounded-full border border-white/15 bg-white/5 text-lg text-brand-soft disabled:opacity-35"
          aria-label="Trước"
          :disabled="!hasPrev && state.repeat === 'off'"
          @click="prev"
        >
          ‹
        </button>
        <button
          type="button"
          class="size-9 rounded-full bg-brand-soft text-base font-semibold text-ink"
          :aria-label="state.playing ? 'Tạm dừng' : 'Phát'"
          @click="toggle"
        >
          {{ state.loading ? '…' : state.playing ? '❚❚' : '▶' }}
        </button>
        <button
          type="button"
          class="size-8 rounded-full border border-white/15 bg-white/5 text-lg text-brand-soft disabled:opacity-35"
          aria-label="Sau"
          :disabled="!hasNext && state.repeat === 'off'"
          @click="next"
        >
          ›
        </button>
        <button
          type="button"
          class="hidden size-8 rounded-full text-xs font-bold sm:grid sm:place-items-center"
          :class="state.repeat !== 'off' ? 'bg-brand-soft/30 text-brand-soft' : 'text-white/45'"
          title="Lặp lại"
          @click="cycleRepeat"
        >
          {{ repeatLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seek {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  outline: none;
  cursor: pointer;
}

.seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #8d6e63;
  border: 0;
  box-shadow: 0 0 0 2px rgba(42, 24, 16, 0.5);
}

.seek::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #8d6e63;
  border: 0;
}

.seek:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
