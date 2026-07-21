<script setup lang="ts">
import type { ChatMessage } from '../../types'

defineProps<{
  message: ChatMessage
}>()

function copyText(text: string) {
  void navigator.clipboard.writeText(text)
}
</script>

<template>
  <article class="msg" :class="message.role">
    <div class="col">
      <!-- User: right-aligned bubble (ChatGPT style) -->
      <div v-if="message.role === 'user'" class="user-wrap">
        <div class="user-bubble">{{ message.content }}</div>
      </div>

      <!-- Assistant: left column with avatar -->
      <div v-else class="assistant-row">
        <div class="avatar" aria-hidden="true">
          <img src="/logo-tosuthien.png" alt="" width="28" height="28" />
        </div>
        <div class="assistant-body">
          <div class="label-row">
            <span class="label">Tổ Sư Thiền</span>
            <button
              v-if="!message.streaming && message.content"
              type="button"
              class="copy"
              title="Sao chép"
              @click="copyText(message.content)"
            >
              Sao chép
            </button>
          </div>
          <div class="scripture">
            {{ message.content || (message.streaming ? '…' : '') }}
          </div>
          <ul v-if="message.citations?.length" class="cites">
            <li v-for="(c, j) in message.citations" :key="j">
              <a
                v-if="c.pdf?.pdfUrl"
                :href="`${c.pdf.pdfUrl}#page=${c.pdf.pageNum ?? c.pageNum ?? 1}`"
                target="_blank"
                rel="noopener"
              >
                {{ c.openLabel || c.pdf.openLabel || c.title || 'Mở PDF' }}
              </a>
              <span v-else>{{ c.title }}{{ c.pageNum ? ` · tr.${c.pageNum}` : '' }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.msg {
  width: 100%;
  padding: 0.85rem 0;
}

.col {
  width: var(--c-col);
  margin: 0 auto;
  padding: 0 1rem;
}

.user-wrap {
  display: flex;
  justify-content: flex-end;
}

.user-bubble {
  max-width: min(85%, 36rem);
  background: var(--c-surface-high);
  border-radius: 1.35rem;
  border-bottom-right-radius: 0.35rem;
  padding: 0.75rem 1.05rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.98rem;
}

.assistant-row {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.avatar {
  width: 28px;
  height: 28px;
  margin-top: 2px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--c-surface-mid);
}

.avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.assistant-body {
  flex: 1;
  min-width: 0;
  padding-top: 0.1rem;
}

.label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.label {
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--c-on);
}

.copy {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--c-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
}

.copy:hover {
  background: var(--c-surface-mid);
  color: var(--c-primary);
}

.scripture {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
  font-size: 1rem;
  color: var(--c-on);
}

.cites {
  margin: 0.85rem 0 0;
  padding: 0.75rem 0.9rem;
  list-style: none;
  background: var(--c-surface-low);
  border-radius: 12px;
  border: 1px solid var(--c-outline);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cites a {
  color: var(--c-primary);
  text-decoration: none;
  font-weight: 500;
}

.cites a:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
