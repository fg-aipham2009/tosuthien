import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { askStream, fetchSources } from '../api/chat'
import {
  loadConversations,
  saveConversations,
  newConversationId,
  titleFromMessages,
  type Conversation,
} from '../lib/chatHistory'
import type { ChatMessage, RagSource } from '../types'

const SIDEBAR_BP = 720

export function useMediaWide(breakpoint = SIDEBAR_BP) {
  const wide = ref(typeof window !== 'undefined' ? window.innerWidth >= breakpoint : true)
  function onResize() {
    wide.value = window.innerWidth >= breakpoint
  }
  onMounted(() => {
    onResize()
    window.addEventListener('resize', onResize)
  })
  onUnmounted(() => window.removeEventListener('resize', onResize))
  return wide
}

export function useChat(listEl: Ref<HTMLElement | null>) {
  const conversations = ref<Conversation[]>([])
  const activeId = ref('')
  const sources = ref<RagSource[]>([])
  const selected = ref<string[]>([])
  const messages = ref<ChatMessage[]>([])
  const input = ref('')
  const phase = ref('')
  const busy = ref(false)
  const error = ref('')
  const drawerOpen = ref(false)
  const pickerOpen = ref(false)
  const pickerDraft = ref<string[]>([])
  let abort: AbortController | null = null
  let persistWatchPaused = false

  const active = computed(() => conversations.value.find((c) => c.id === activeId.value))
  const title = computed(() => active.value?.title || 'Hỏi đáp kinh sách')
  const filterLabel = computed(() => {
    if (!selected.value.length) return 'Tất cả sách'
    if (selected.value.length === 1) {
      return sources.value.find((s) => s.sourceFile === selected.value[0])?.title ?? '1 sách'
    }
    if (selected.value.length <= 3) {
      return selected.value
        .map((f) => sources.value.find((s) => s.sourceFile === f)?.title ?? f)
        .join(' · ')
    }
    return `${selected.value.length} sách`
  })

  function persist() {
    const idx = conversations.value.findIndex((c) => c.id === activeId.value)
    if (idx < 0) return
    conversations.value[idx] = {
      ...conversations.value[idx],
      title: titleFromMessages(messages.value),
      updatedAt: Date.now(),
      messages: messages.value.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations,
      })),
      sourceFiles: [...selected.value],
    }
    conversations.value = [...conversations.value].sort((a, b) => b.updatedAt - a.updatedAt)
    saveConversations(conversations.value)
  }

  function createConversation(select = true) {
    const c: Conversation = {
      id: newConversationId(),
      title: 'Hội thoại mới',
      updatedAt: Date.now(),
      messages: [],
      sourceFiles: [],
    }
    conversations.value = [c, ...conversations.value]
    if (select) {
      persistWatchPaused = true
      activeId.value = c.id
      messages.value = []
      selected.value = []
      persistWatchPaused = false
    }
    saveConversations(conversations.value)
  }

  function selectConversation(id: string) {
    persist()
    const c = conversations.value.find((x) => x.id === id)
    if (!c) return
    persistWatchPaused = true
    activeId.value = c.id
    messages.value = c.messages.map((m) => ({ ...m }))
    selected.value = [...c.sourceFiles]
    persistWatchPaused = false
    drawerOpen.value = false
    error.value = ''
  }

  function deleteConversation(id: string) {
    if (!confirm('Xóa hội thoại này? Không thể khôi phục.')) return
    conversations.value = conversations.value.filter((c) => c.id !== id)
    saveConversations(conversations.value)
    if (activeId.value === id) {
      if (conversations.value[0]) selectConversation(conversations.value[0].id)
      else createConversation()
    }
  }

  function newChat() {
    persist()
    createConversation()
    drawerOpen.value = false
  }

  async function scrollBottom() {
    await nextTick()
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  }

  function openPicker() {
    pickerDraft.value = [...selected.value]
    pickerOpen.value = true
  }

  function closePicker() {
    pickerOpen.value = false
  }

  function applyPicker() {
    selected.value = [...pickerDraft.value]
    pickerOpen.value = false
  }

  function clearFilter() {
    selected.value = []
  }

  function clearPickerDraft() {
    pickerDraft.value = []
  }

  function toggleDraft(file: string) {
    const i = pickerDraft.value.indexOf(file)
    if (i >= 0) pickerDraft.value.splice(i, 1)
    else pickerDraft.value.push(file)
  }

  function clearError() {
    error.value = ''
  }

  async function send() {
    const q = input.value.trim()
    if (!q || busy.value) return
    error.value = ''
    input.value = ''
    messages.value.push({ role: 'user', content: q })
    const history = messages.value.slice(0, -1)
    messages.value.push({ role: 'assistant', content: '', streaming: true, citations: [] })
    busy.value = true
    phase.value = 'retrieving'
    await scrollBottom()

    abort?.abort()
    abort = new AbortController()
    const assistant = messages.value[messages.value.length - 1]

    try {
      await askStream(
        q,
        history,
        selected.value.length ? [...selected.value] : undefined,
        {
          onStatus: (p) => {
            phase.value = p
          },
          onDelta: (t) => {
            assistant.content += t
            void scrollBottom()
          },
          onDone: (payload) => {
            assistant.content = payload.answer || assistant.content
            assistant.citations = payload.citations
            assistant.streaming = false
            phase.value = ''
          },
          onError: (m) => {
            error.value = m
            assistant.streaming = false
          },
        },
        abort.signal,
      )
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        error.value = e instanceof Error ? e.message : 'Lỗi hỏi đáp'
        assistant.content = assistant.content || 'Xin lỗi, không nhận được câu trả lời.'
        assistant.streaming = false
      }
    } finally {
      busy.value = false
      phase.value = ''
      await scrollBottom()
    }
  }

  onMounted(async () => {
    conversations.value = loadConversations()
    if (!conversations.value.length) createConversation()
    else {
      activeId.value = conversations.value[0].id
      messages.value = conversations.value[0].messages.map((m) => ({ ...m }))
      selected.value = [...conversations.value[0].sourceFiles]
    }
    try {
      sources.value = (await fetchSources()).filter((s) => !!s.sourceFile)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Không tải được danh sách sách'
    }
  })

  onUnmounted(() => {
    abort?.abort()
    persist()
  })

  watch(
    [messages, selected],
    () => {
      if (!persistWatchPaused) persist()
    },
    { deep: true },
  )

  return {
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
    toggleDraft,
    clearError,
    send,
  }
}
