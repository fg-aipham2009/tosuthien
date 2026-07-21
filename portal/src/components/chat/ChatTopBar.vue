<script setup lang="ts">
defineProps<{
  title: string
  showMenu?: boolean
}>()

const emit = defineEmits<{
  menu: []
  new: []
}>()
</script>

<template>
  <header class="topbar">
    <div class="left">
      <button
        v-if="showMenu"
        type="button"
        class="icon-btn"
        title="Mở lịch sử hội thoại"
        aria-label="Mở lịch sử hội thoại"
        @click="emit('menu')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h10"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
    <h1>{{ title }}</h1>
    <div class="right">
      <button type="button" class="icon-btn" title="Hội thoại mới" @click="emit('new')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: 1fr minmax(0, auto) 1fr;
  align-items: center;
  gap: 0.5rem;
  min-height: 3.25rem;
  padding: 0.35rem 0.65rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--c-outline);
  position: sticky;
  top: 0;
  z-index: 5;
}

.topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: min(52vw, 28rem);
}

.left,
.right {
  display: flex;
  align-items: center;
}

.right {
  justify-content: flex-end;
}

.icon-btn {
  width: 2.35rem;
  height: 2.35rem;
  border: 0;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  color: var(--c-on);
  display: grid;
  place-items: center;
}

.icon-btn:hover {
  background: var(--c-surface-mid);
}
</style>
