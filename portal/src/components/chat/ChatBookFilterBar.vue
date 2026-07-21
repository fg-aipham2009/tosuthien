<script setup lang="ts">
defineProps<{
  label: string
  selectedCount: number
}>()

const emit = defineEmits<{
  open: []
  clear: []
}>()
</script>

<template>
  <div
    class="filter-bar"
    :class="{ filtered: selectedCount > 0 }"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
  >
    <span class="filter-ico" aria-hidden="true">{{ selectedCount ? '▽' : '☰' }}</span>
    <span class="filter-text">
      <strong>Lọc sách: {{ label }}</strong>
      <small>
        {{
          selectedCount
            ? `Đang lọc ${selectedCount} sách — chỉ trả lời từ sách đã chọn (giữ qua các lượt hỏi)`
            : 'Bấm để chọn sách trước khi hỏi. Chưa chọn = toàn bộ kho.'
        }}
      </small>
    </span>
    <button
      v-if="selectedCount"
      type="button"
      class="clear-filter"
      title="Bỏ lọc"
      @click.stop="emit('clear')"
    >
      ×
    </button>
    <span v-else class="chev" aria-hidden="true">▾</span>
  </div>
</template>

<style scoped>
.filter-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-align: left;
  border: 1px solid var(--c-outline);
  border-radius: 14px;
  padding: 0.7rem 0.35rem 0.7rem 0.85rem;
  margin-bottom: 0.65rem;
  background: var(--c-surface-mid);
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: background 0.15s, border-color 0.15s;
}

.filter-bar:hover {
  border-color: rgba(93, 64, 55, 0.28);
}

.filter-bar.filtered {
  background: var(--c-secondary-container);
  border-color: transparent;
  color: var(--c-on-secondary-container);
}

.filter-ico {
  color: var(--c-primary);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.filter-bar.filtered .filter-ico {
  color: var(--c-on-secondary-container);
}

.filter-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.filter-text strong {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-text small {
  font-size: 0.75rem;
  opacity: 0.88;
  line-height: 1.35;
}

.clear-filter,
.chev {
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1.15rem;
  flex-shrink: 0;
  border-radius: 50%;
}

.clear-filter:hover {
  background: rgba(0, 0, 0, 0.06);
}
</style>
