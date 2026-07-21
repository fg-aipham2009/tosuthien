<script setup lang="ts">
import type { Conversation } from '../../lib/chatHistory'

defineProps<{
  conversations: Conversation[]
  activeId: string
}>()

const emit = defineEmits<{
  new: []
  select: [id: string]
  delete: [id: string]
  collapse: []
}>()
</script>

<template>
  <div class="sidebar">
    <div class="side-top">
      <button
        type="button"
        class="icon-btn"
        title="Thu gọn thanh bên"
        aria-label="Thu gọn thanh bên"
        @click="emit('collapse')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h10M4 18h16"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
          <path
            d="M19 9l-3 3 3 3"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button type="button" class="new-btn" @click="emit('new')">
        <span class="plus" aria-hidden="true">＋</span>
        Hội thoại mới
      </button>
    </div>

    <p class="section-label">Gần đây</p>
    <ul class="side-list">
      <li v-for="c in conversations" :key="c.id">
        <button
          type="button"
          class="side-item"
          :class="{ on: c.id === activeId }"
          @click="emit('select', c.id)"
        >
          <span class="side-title">{{ c.title }}</span>
        </button>
        <button
          type="button"
          class="side-del"
          title="Xóa"
          @click.stop="emit('delete', c.id)"
        >
          ×
        </button>
      </li>
      <li v-if="!conversations.length" class="empty">Chưa có hội thoại</li>
    </ul>
  </div>
</template>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  height: 100%;
  background: var(--c-sidebar);
  color: var(--c-sidebar-on);
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.side-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 0.65rem 0.35rem;
}

.icon-btn {
  width: 2.35rem;
  height: 2.35rem;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  color: var(--c-sidebar-on);
  display: grid;
  place-items: center;
}

.icon-btn:hover {
  background: var(--c-sidebar-hover);
}

.new-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  color: var(--c-sidebar-on);
  font-weight: 500;
  transition: background 0.15s;
}

.new-btn:hover {
  background: var(--c-sidebar-hover);
}

.plus {
  font-size: 1.05rem;
  line-height: 1;
}

.section-label {
  margin: 0.75rem 0.9rem 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--c-sidebar-muted);
}

.side-list {
  list-style: none;
  margin: 0;
  padding: 0 0.45rem 1rem;
  overflow: auto;
  flex: 1;
}

.side-list li {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border-radius: 10px;
}

.side-list li:hover {
  background: var(--c-sidebar-hover);
}

.side-item {
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0.6rem 0.7rem;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  color: var(--c-sidebar-on);
  min-width: 0;
}

.side-item.on {
  background: var(--c-sidebar-hover);
}

.side-title {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-del {
  opacity: 0;
  border: 0;
  background: transparent;
  color: var(--c-sidebar-muted);
  cursor: pointer;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  font-size: 1.05rem;
  margin-right: 0.2rem;
}

.side-list li:hover .side-del,
.side-item.on + .side-del {
  opacity: 1;
}

.empty {
  padding: 0.75rem 0.85rem;
  font-size: 0.85rem;
  color: var(--c-sidebar-muted);
  display: block !important;
}
</style>
