<script setup lang="ts">
import type { RagSource } from '../../types'

const draft = defineModel<string[]>({ required: true })

defineProps<{
  sources: RagSource[]
}>()

const emit = defineEmits<{
  close: []
  apply: []
  clear: []
}>()

function toggle(file: string) {
  const i = draft.value.indexOf(file)
  if (i >= 0) draft.value = draft.value.filter((f) => f !== file)
  else draft.value = [...draft.value, file]
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-label="Chọn sách để hỏi">
      <header>
        <h3>Chọn sách để hỏi</h3>
        <button type="button" class="icon-btn" @click="emit('close')">×</button>
      </header>
      <p class="modal-hint">
        {{
          draft.length
            ? `Đã chọn ${draft.length} sách — mọi câu hỏi tiếp theo chỉ lấy từ các sách này.`
            : 'Chưa chọn → hỏi trong toàn bộ kho. Tick sách để giới hạn câu trả lời (giữ qua các lượt hỏi tiếp).'
        }}
      </p>
      <ul class="book-list">
        <li v-for="s in sources" :key="s.sourceFile">
          <label>
            <input
              type="checkbox"
              :checked="draft.includes(s.sourceFile)"
              @change="toggle(s.sourceFile)"
            />
            <span>{{ s.title }}</span>
            <small class="file">{{ s.sourceFile }}</small>
          </label>
        </li>
      </ul>
      <footer>
        <button type="button" class="text-btn" @click="emit('clear')">Tất cả sách</button>
        <div class="footer-actions">
          <button type="button" class="text-btn" @click="emit('close')">Hủy</button>
          <button type="button" class="filled-btn" @click="emit('apply')">Áp dụng</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.modal {
  width: min(440px, 100%);
  max-height: min(78vh, 640px);
  background: var(--c-surface);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0.5rem 0.5rem 1.25rem;
}

h3 {
  margin: 0;
  font-size: 1.05rem;
}

.icon-btn {
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
}

.modal-hint {
  margin: 0;
  padding: 0 1.25rem 0.5rem;
  font-size: 0.82rem;
  color: var(--c-muted);
  line-height: 1.4;
}

.book-list {
  list-style: none;
  margin: 0;
  padding: 0 0.5rem;
  overflow: auto;
  flex: 1;
}

label {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.65rem;
  align-items: start;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1.35;
}

label input {
  grid-row: 1 / span 2;
  margin-top: 0.2rem;
}

label .file {
  grid-column: 2;
  font-size: 0.72rem;
  color: var(--c-muted);
}

label:hover {
  background: var(--c-surface-low);
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem 1rem;
  border-top: 1px solid rgba(154, 142, 138, 0.25);
}

.text-btn {
  border: 0;
  background: transparent;
  color: var(--c-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 0.45rem 0.65rem;
}

.filled-btn {
  border: 0;
  background: var(--c-primary);
  color: #fff;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.footer-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}
</style>
