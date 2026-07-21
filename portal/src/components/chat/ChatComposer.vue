<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const input = defineModel<string>({ required: true })
const ta = ref<HTMLTextAreaElement | null>(null)

defineProps<{
  busy: boolean
}>()

const emit = defineEmits<{
  send: []
}>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('send')
  }
}

function autosize() {
  const el = ta.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

watch(input, () => nextTick(autosize))
</script>

<template>
  <form class="composer" @submit.prevent="emit('send')">
    <textarea
      ref="ta"
      v-model="input"
      rows="1"
      placeholder="Nhập câu hỏi…"
      :disabled="busy"
      @keydown="onKey"
      @input="autosize"
    />
    <button type="submit" class="send" :disabled="busy || !input.trim()" :aria-busy="busy">
      <span v-if="busy" class="chat-spinner light" />
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </form>
</template>

<style scoped>
.composer {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  background: var(--c-surface);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 1.5rem;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.06);
  padding: 0.45rem 0.45rem 0.45rem 0.35rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.composer:focus-within {
  border-color: rgba(93, 64, 55, 0.35);
  box-shadow:
    0 0 0 3px rgba(93, 64, 55, 0.08),
    0 8px 24px rgba(0, 0, 0, 0.06);
}

textarea {
  flex: 1;
  border: 0;
  background: transparent;
  resize: none;
  min-height: 1.5rem;
  max-height: 10rem;
  padding: 0.55rem 0.85rem;
  font: inherit;
  font-size: 1rem;
  line-height: 1.45;
  color: var(--c-on);
  outline: none;
}

.send {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--c-primary);
  color: var(--c-on-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: opacity 0.15s, background 0.15s;
}

.send:disabled {
  background: var(--c-surface-high);
  color: var(--c-muted);
  cursor: not-allowed;
}
</style>
