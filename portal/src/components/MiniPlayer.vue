<script setup lang="ts">
import { usePlayer } from '../stores/player'

const { state, current, toggle, next, prev, setExpanded } = usePlayer()
</script>

<template>
  <div v-if="current" class="mini" :class="{ open: state.expanded }">
    <button class="hit" type="button" @click="setExpanded(!state.expanded)">
      <span class="title">{{ current.title }}</span>
      <span class="hint">{{ state.playing ? 'Đang phát' : 'Tạm dừng' }}</span>
    </button>
    <div class="controls">
      <button type="button" @click="prev" aria-label="Trước">‹</button>
      <button type="button" class="play" @click="toggle">
        {{ state.playing ? '❚❚' : '▶' }}
      </button>
      <button type="button" @click="next" aria-label="Sau">›</button>
    </div>
  </div>
</template>

<style scoped>
.mini {
  position: fixed;
  left: 0.75rem;
  right: 0.75rem;
  bottom: calc(4.2rem + env(safe-area-inset-bottom));
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 14px;
  background: rgba(42, 24, 16, 0.95);
  border: 1px solid var(--line);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

@media (min-width: 860px) {
  .mini {
    bottom: 1.25rem;
    left: auto;
    right: 1.25rem;
    width: min(420px, calc(100vw - 2.5rem));
  }
}

.hit {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 0;
}

.title {
  display: block;
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--paper);
}

.hint {
  font-size: 0.72rem;
  color: var(--muted);
}

.controls {
  display: flex;
  gap: 0.35rem;
}

.controls button {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--gold-soft);
  cursor: pointer;
}

.controls .play {
  background: var(--gold);
  color: var(--ink);
  border-color: transparent;
}

@media (min-width: 860px) {
  .mini {
    left: auto;
    right: 1.25rem;
    bottom: 1.25rem;
    width: min(420px, calc(100vw - 2.5rem));
  }
}
</style>
