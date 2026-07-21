<script setup lang="ts">
import { usePlayer } from '../stores/player'

const { state, current, toggle, next, prev, setExpanded } = usePlayer()
</script>

<template>
  <div
    v-if="current"
    class="fixed right-3 bottom-[calc(4.2rem+env(safe-area-inset-bottom))] left-3 z-25 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#2a1810]/95 px-3.5 py-2.5 text-white shadow-xl lg:right-5 lg:bottom-5 lg:left-auto lg:w-[min(420px,calc(100vw-2.5rem))]"
  >
    <button class="min-w-0 flex-1 p-0 text-left" type="button" @click="setExpanded(!state.expanded)">
      <span class="block truncate text-sm text-white">{{ current.title }}</span>
      <span class="text-xs text-white/60">{{ state.playing ? 'Đang phát' : 'Tạm dừng' }}</span>
    </button>
    <div class="flex gap-1.5">
      <button
        type="button"
        class="size-8 rounded-full border border-white/15 bg-white/5 text-brand-soft"
        aria-label="Trước"
        @click="prev"
      >
        ‹
      </button>
      <button
        type="button"
        class="size-8 rounded-full bg-brand-soft font-semibold text-ink"
        @click="toggle"
      >
        {{ state.playing ? '❚❚' : '▶' }}
      </button>
      <button
        type="button"
        class="size-8 rounded-full border border-white/15 bg-white/5 text-brand-soft"
        aria-label="Sau"
        @click="next"
      >
        ›
      </button>
    </div>
  </div>
</template>
