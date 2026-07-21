<script setup lang="ts">
import { ref } from 'vue'
import { useChat, useMediaWide } from '../composables/useChat'
import ChatHistorySidebar from '../components/chat/ChatHistorySidebar.vue'
import ChatTopBar from '../components/chat/ChatTopBar.vue'
import ChatWelcome from '../components/chat/ChatWelcome.vue'
import ChatMessageBubble from '../components/chat/ChatMessageBubble.vue'
import ChatLoadingRow from '../components/chat/ChatLoadingRow.vue'
import ChatBookFilterBar from '../components/chat/ChatBookFilterBar.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ChatBookPicker from '../components/chat/ChatBookPicker.vue'
import ChatErrorBanner from '../components/chat/ChatErrorBanner.vue'
import '../components/chat/chat-theme.css'

const listEl = ref<HTMLElement | null>(null)
const wide = useMediaWide(860)

const {
  conversations,
  activeId,
  sources,
  selected,
  messages,
  input,
  phase,
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
} = useChat(listEl)

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
</script>

<template>
  <div class="chat-root chat-theme">
    <ChatHistorySidebar
      v-if="wide"
      :conversations="conversations"
      :active-id="activeId"
      @new="onNew"
      @select="onSelect"
      @delete="deleteConversation"
    />

    <div v-if="!wide && drawerOpen" class="drawer-backdrop" @click="drawerOpen = false" />
    <aside v-if="!wide" class="drawer" :class="{ open: drawerOpen }" :aria-hidden="!drawerOpen">
      <ChatHistorySidebar
        :conversations="conversations"
        :active-id="activeId"
        @new="onNew"
        @select="onSelect"
        @delete="deleteConversation"
      />
    </aside>

    <section class="pane">
      <ChatTopBar
        :title="title"
        :show-menu="!wide"
        @menu="drawerOpen = true"
        @new="onNew"
      />

      <ChatErrorBanner v-if="error" :message="error" @close="clearError" />

      <div ref="listEl" class="messages" :class="{ empty: !messages.length }">
        <ChatWelcome v-if="!messages.length" @suggest="onSuggest" />
        <template v-else>
          <div class="thread">
            <ChatMessageBubble v-for="(m, i) in messages" :key="i" :message="m" />
            <ChatLoadingRow v-if="busy || phase" :phase="phase" />
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
                ? `Đang khóa ${selected.length} sách — Enter gửi · Shift+Enter xuống dòng`
                : 'Enter gửi · Shift+Enter xuống dòng · chọn “Lọc sách” để khóa nguồn'
            }}
          </p>
        </div>
      </footer>
    </section>

    <ChatBookPicker
      v-if="pickerOpen"
      v-model="pickerDraft"
      :sources="sources"
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
