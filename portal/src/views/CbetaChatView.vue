<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCbetaChat } from '../composables/useCbetaChat'
import { useMediaWide } from '../composables/useChat'
import ChatHistorySidebar from '../components/chat/ChatHistorySidebar.vue'
import ChatTopBar from '../components/chat/ChatTopBar.vue'
import ChatMessageBubble from '../components/chat/ChatMessageBubble.vue'
import ChatLoadingRow from '../components/chat/ChatLoadingRow.vue'
import ChatBookFilterBar from '../components/chat/ChatBookFilterBar.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ChatBookPicker from '../components/chat/ChatBookPicker.vue'
import ChatErrorBanner from '../components/chat/ChatErrorBanner.vue'
import type { Conversation } from '../lib/chatHistory'
import type { RagSource } from '../types'
import '../components/chat/chat-theme.css'

const SIDEBAR_KEY = 'tosuthien.cbeta.chat.sidebarCollapsed'

const listEl = ref<HTMLElement | null>(null)
const wide = useMediaWide(860)
const sidebarCollapsed = ref(false)

onMounted(() => {
  try {
    sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    /* ignore */
  }
})

watch(sidebarCollapsed, (v) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
})

const {
  conversations,
  activeId,
  collections,
  selected,
  messages,
  input,
  phase,
  statusMessage,
  busy,
  error,
  drawerOpen,
  pickerOpen,
  pickerDraft,
  title,
  filterLabel,
  selectConversation,
  deleteConversation,
  newChat,
  openPicker,
  closePicker,
  applyPicker,
  clearFilter,
  clearPickerDraft,
  clearError,
  send,
} = useCbetaChat(listEl)

/** Adapt for shared sidebar/picker components. */
const sidebarConversations = computed<Conversation[]>(() =>
  conversations.value.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messages: c.messages,
    sourceFiles: c.collections,
  })),
)

const pickerSources = computed<RagSource[]>(() =>
  collections.value.map((c) => ({
    id: c.code,
    title: `${c.code} — ${c.nameZh}`,
    sourceFile: c.code,
    sortOrder: c.works,
  })),
)

const suggestions = [
  '虛雲和尚如何參禪？',
  '來果禪師禪七開示要旨',
  'Liệt kê các vị tổ trong truyền đăng lục',
]

function onSuggest(text: string) {
  input.value = text
  void send()
}

function onSelect(id: string) {
  selectConversation(id)
  drawerOpen.value = false
}

function onNew() {
  newChat()
  drawerOpen.value = false
}

function collapseSidebar() {
  if (wide.value) sidebarCollapsed.value = true
  else drawerOpen.value = false
}

function openSidebar() {
  if (wide.value) sidebarCollapsed.value = false
  else drawerOpen.value = true
}
</script>

<template>
  <div class="chat-root chat-theme">
    <ChatHistorySidebar
      v-if="wide && !sidebarCollapsed"
      :conversations="sidebarConversations"
      :active-id="activeId"
      @new="onNew"
      @select="onSelect"
      @delete="deleteConversation"
      @collapse="collapseSidebar"
    />

    <div v-if="!wide && drawerOpen" class="drawer-backdrop" @click="drawerOpen = false" />
    <aside v-if="!wide" class="drawer" :class="{ open: drawerOpen }" :aria-hidden="!drawerOpen">
      <ChatHistorySidebar
        :conversations="sidebarConversations"
        :active-id="activeId"
        @new="onNew"
        @select="onSelect"
        @delete="deleteConversation"
        @collapse="collapseSidebar"
      />
    </aside>

    <section class="pane">
      <ChatTopBar
        :title="title"
        :show-menu="!wide || sidebarCollapsed"
        @menu="openSidebar"
        @new="onNew"
      />

      <ChatErrorBanner v-if="error" :message="error" @close="clearError" />

      <div ref="listEl" class="messages" :class="{ empty: !messages.length }">
        <div v-if="!messages.length" class="welcome">
          <div class="hero">
            <img src="/logo-tosuthien.png" alt="" width="56" height="56" class="logo" />
            <h2>Hỏi đáp Đại tạng CBETA</h2>
            <p>Tra cứu nguyên văn Hán — ngữ lục tổ, truyền đăng, Hư Vân / Lai Quả…</p>
          </div>
          <div class="chips">
            <button
              v-for="s in suggestions"
              :key="s"
              type="button"
              class="chip"
              @click="onSuggest(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>
        <template v-else>
          <div class="thread">
            <ChatMessageBubble v-for="(m, i) in messages" :key="i" :message="m" />
            <ChatLoadingRow v-if="busy || phase" :phase="statusMessage || phase" />
          </div>
        </template>
      </div>

      <footer class="dock">
        <div class="dock-inner">
          <ChatBookFilterBar
            :label="filterLabel"
            :selected-count="selected.length"
            @open="openPicker"
            @clear="clearFilter"
          />
          <ChatComposer v-model="input" :busy="busy" @send="send" />
          <p class="hint">
            {{
              selected.length
                ? `Đang khóa ${selected.length} bộ CBETA — Enter gửi · Shift+Enter xuống dòng`
                : 'API /api/cbeta · Enter gửi · chọn bộ (T/X/XY…) để thu hẹp'
            }}
          </p>
        </div>
      </footer>
    </section>

    <ChatBookPicker
      v-if="pickerOpen"
      v-model="pickerDraft"
      :sources="pickerSources"
      @close="closePicker"
      @apply="applyPicker"
      @clear="clearPickerDraft"
    />
  </div>
</template>

<style scoped>
.chat-root {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--c-surface);
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
  background: rgba(0, 0, 0, 0.45);
}

.drawer {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 50;
  width: min(280px, 86vw);
  transform: translateX(-105%);
  transition: transform 0.22s ease;
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.28);
  height: 100%;
}

.drawer.open {
  transform: none;
}

.drawer :deep(.sidebar) {
  width: 100%;
  height: 100%;
}

.pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  position: relative;
}

.messages {
  flex: 1;
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.messages.empty {
  justify-content: stretch;
}

.thread {
  width: 100%;
  padding: 0.5rem 0 1.5rem;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  width: var(--c-col);
  margin: 0 auto;
  padding: 2rem 1rem 1rem;
  text-align: center;
  min-height: 0;
}

.logo {
  border-radius: 50%;
  margin-bottom: 1rem;
  box-shadow: 0 4px 20px rgba(93, 64, 55, 0.18);
}

.hero h2 {
  margin: 0 0 0.5rem;
  font-size: clamp(1.45rem, 3.5vw, 1.85rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--c-on);
}

.hero p {
  margin: 0;
  color: var(--c-muted);
  line-height: 1.45;
  font-size: 0.95rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: center;
  max-width: 36rem;
}

.chip {
  border: 1px solid rgba(93, 64, 55, 0.18);
  background: #fff;
  color: var(--c-on);
  border-radius: 999px;
  padding: 0.55rem 0.95rem;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.chip:hover {
  background: rgba(93, 64, 55, 0.06);
  border-color: rgba(93, 64, 55, 0.35);
}

.dock {
  flex-shrink: 0;
  background: linear-gradient(to top, #fff 70%, rgba(255, 255, 255, 0));
  padding-top: 0.5rem;
}

.dock-inner {
  width: var(--c-col);
  margin: 0 auto;
  padding: 0 1rem 0.75rem;
}

.hint {
  margin: 0.55rem 0 0;
  text-align: center;
  font-size: 0.72rem;
  color: var(--c-muted);
  line-height: 1.35;
}
</style>
