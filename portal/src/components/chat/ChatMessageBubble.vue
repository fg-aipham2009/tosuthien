<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatCitation, ChatMessage } from '../../types'
import {
  citationBody,
  defaultFilePage,
  resolveCitationPdfFileUrl,
  scriptureOnly,
  tappablePages,
} from '../../lib/openCitation'

const props = defineProps<{
  message: ChatMessage
}>()

const openingKey = ref<string | null>(null)
const openError = ref('')

const scripture = computed(() => scriptureOnly(props.message.content || ''))
const aiText = computed(() => props.message.aiInterpretation?.trim() || '')
const citations = computed(() => props.message.citations ?? [])

function copyText(text: string) {
  void navigator.clipboard.writeText(text)
}

async function openCitation(c: ChatCitation, filePage?: number) {
  openError.value = ''
  const page = filePage ?? defaultFilePage(c)
  const key = `${c.passageId || c.title || ''}:${page}`
  if (openingKey.value) return
  openingKey.value = key
  try {
    const href = await resolveCitationPdfFileUrl(c, page)
    if (!href) {
      openError.value = 'Chưa gắn được bản PDF cho trích dẫn này.'
      return
    }
    const opened = window.open(href, '_blank', 'noopener,noreferrer')
    if (!opened) {
      openError.value = 'Trình duyệt đang chặn tab mới — cho phép popup rồi thử lại.'
    }
  } catch (e) {
    openError.value = e instanceof Error ? e.message : 'Không mở được trang kinh'
  } finally {
    openingKey.value = null
  }
}

function canOpen(c: ChatCitation): boolean {
  return !!(c.pdf?.pdfFileId || c.sourceFile)
}
</script>

<template>
  <article class="msg" :class="message.role">
    <div class="col">
      <div v-if="message.role === 'user'" class="user-wrap">
        <div class="user-bubble">{{ message.content }}</div>
      </div>

      <div v-else class="assistant-row">
        <div class="avatar" aria-hidden="true">
          <img src="/logo-tosuthien.png" alt="" width="28" height="28" />
        </div>
        <div class="assistant-body">
          <template v-if="scripture || message.streaming">
            <div class="label-row">
              <span class="label scripture-label">Nguyên văn kinh sách</span>
              <button
                v-if="!message.streaming && scripture"
                type="button"
                class="copy"
                title="Sao chép nguyên văn"
                @click="copyText(scripture)"
              >
                Sao chép
              </button>
            </div>
            <div class="scripture">
              {{ scripture || (message.streaming ? '…' : '') }}
            </div>
          </template>

          <section v-if="citations.length" class="cites-section">
            <h3 class="section-title">Kinh sách trích dẫn ({{ citations.length }})</h3>
            <ul class="cite-cards">
              <li v-for="(c, j) in citations" :key="c.passageId || j" class="cite-card">
                <div class="cite-head">
                  <strong class="cite-title">{{ c.title || c.label || 'Kinh sách' }}</strong>
                  <div v-if="tappablePages(c).length" class="page-chips">
                    <button
                      v-for="link in tappablePages(c)"
                      :key="`${link.printed}-${link.filePage}`"
                      type="button"
                      class="page-chip"
                      :disabled="!canOpen(c) || openingKey !== null"
                      :title="link.openLabel"
                      @click="openCitation(c, link.filePage)"
                    >
                      {{ link.openLabel || `tr.${link.printed}` }}
                    </button>
                  </div>
                  <button
                    v-else-if="canOpen(c)"
                    type="button"
                    class="page-chip"
                    :disabled="openingKey !== null"
                    @click="openCitation(c)"
                  >
                    {{ c.openLabel || c.pdf?.openLabel || 'Mở PDF' }}
                  </button>
                </div>
                <p v-if="citationBody(c)" class="cite-body">{{ citationBody(c) }}</p>
              </li>
            </ul>
          </section>

          <section v-if="aiText" class="ai-box">
            <div class="label-row">
              <span class="label ai-label">AI diễn giải</span>
              <button
                type="button"
                class="copy"
                title="Sao chép diễn giải"
                @click="copyText(aiText)"
              >
                Sao chép
              </button>
            </div>
            <p class="ai-note">
              Lời AI — nền từ câu hỏi &amp; nguyên văn; có thể bổ sung kiến thức nền. Không phải kinh văn.
            </p>
            <div class="ai-text">{{ aiText }}</div>
          </section>

          <p v-if="message.disclaimer" class="disclaimer">{{ message.disclaimer }}</p>
          <p v-if="openError" class="open-error">{{ openError }}</p>
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

.scripture-label {
  color: var(--c-primary);
  font-weight: 700;
}

.ai-label {
  color: var(--c-primary);
  font-weight: 700;
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

.cites-section {
  margin-top: 1rem;
}

.section-title {
  margin: 0 0 0.55rem;
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--c-muted);
}

.cite-cards {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.cite-card {
  padding: 0.75rem 0.9rem;
  background: var(--c-surface-low);
  border-radius: 12px;
  border: 1px solid var(--c-outline);
}

.cite-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
}

.cite-title {
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--c-on);
}

.page-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.page-chip {
  border: 1px solid color-mix(in srgb, var(--c-primary) 35%, transparent);
  background: color-mix(in srgb, var(--c-primary) 10%, white);
  color: var(--c-primary);
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
}

.page-chip:hover:not(:disabled) {
  background: color-mix(in srgb, var(--c-primary) 18%, white);
}

.page-chip:disabled {
  opacity: 0.45;
  cursor: default;
}

.cite-body {
  margin: 0.55rem 0 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--c-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-box {
  margin-top: 1rem;
  padding: 0.85rem 0.95rem 1rem;
  border-radius: 12px;
  background: color-mix(in srgb, var(--c-primary) 8%, var(--c-surface-low));
  border: 1px solid var(--c-outline);
}

.ai-note {
  margin: 0 0 0.65rem;
  font-size: 0.75rem;
  font-style: italic;
  color: var(--c-muted);
  line-height: 1.35;
}

.ai-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  font-size: 0.95rem;
  color: var(--c-on);
}

.disclaimer {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  font-style: italic;
  color: var(--c-muted);
  line-height: 1.35;
}

.open-error {
  margin: 0.55rem 0 0;
  font-size: 0.82rem;
  color: #9b1c1c;
}
</style>
