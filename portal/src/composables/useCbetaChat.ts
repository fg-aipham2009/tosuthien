import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { askCbetaStream, fetchCbetaCollections, type CbetaCollection } from '../api/cbeta'
import {
  loadCbetaConversations,
  saveCbetaConversations,
  newCbetaConversationId,
  cbetaTitleFromMessages,
  type CbetaConversation,
} from '../lib/cbetaChatHistory'
import type { ChatMessage } from '../types'

export function useCbetaChat(listEl: Ref<HTMLElement | null>) {
  const conversations = ref<CbetaConversation[]>([])
  const activeId = ref('')
  const collections = ref<CbetaCollection[]>([])
  const selected = ref<string[]>([])
  const messages = ref<ChatMessage[]>([])
  const input = ref('')
  const phase = ref('')
  const statusMessage = ref('')
  const busy = ref(false)
  const error = ref('')
  const drawerOpen = ref(false)
  const pickerOpen = ref(false)
  const pickerDraft = ref<string[]>([])
  let abort: AbortController | null = null
  let persistWatchPaused = false

  const active = computed(() => conversations.value.find((c) => c.id === activeId.value))
  const title = computed(() => active.value?.title || 'Hỏi đáp CBETA')
  const filterLabel = computed(() => {
    if (!selected.value.length) return 'Toàn bộ CBETA'
    if (selected.value.length === 1) {
      const c = collections.value.find((x) => x.code === selected.value[0])
      return c ? `${c.code} · ${c.nameZh}` : selected.value[0]
    }
    return `${selected.value.length} bộ`
  })

  function persist() {
    const idx = conversations.value.findIndex((c) => c.id === activeId.value)
    if (idx < 0) return
    conversations.value[idx] = {
      ...conversations.value[idx],
      title: cbetaTitleFromMessages(messages.value),
      updatedAt: Date.now(),
      messages: messages.value.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations,
        aiInterpretation: m.aiInterpretation,
        disclaimer: m.disclaimer,
      })),
      collections: [...selected.value],
    }
    conversations.value = [...conversations.value].sort((a, b) => b.updatedAt - a.updatedAt)
    saveCbetaConversations(conversations.value)
  }

  function createConversation(select = true) {
    const c: CbetaConversation = {
      id: newCbetaConversationId(),
      title: 'Hội thoại CBETA mới',
      updatedAt: Date.now(),
      messages: [],
      collections: [],
    }
    conversations.value = [c, ...conversations.value]
    if (select) {
      persistWatchPaused = true
      activeId.value = c.id
      messages.value = []
      selected.value = []
      persistWatchPaused = false
    }
    saveCbetaConversations(conversations.value)
  }

  function selectConversation(id: string) {
    persist()
    const c = conversations.value.find((x) => x.id === id)
    if (!c) return
    persistWatchPaused = true
    activeId.value = c.id
    messages.value = c.messages.map((m) => ({ ...m }))
    selected.value = [...(c.collections || [])]
    persistWatchPaused = false
    drawerOpen.value = false
    error.value = ''
  }

  function deleteConversation(id: string) {
    if (!confirm('Xóa hội thoại CBETA này?')) return
    conversations.value = conversations.value.filter((c) => c.id !== id)
    saveCbetaConversations(conversations.value)
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
    statusMessage.value = ''
    await scrollBottom()

    abort?.abort()
    abort = new AbortController()
    const assistant = messages.value[messages.value.length - 1]

    try {
      await askCbetaStream(
        q,
        history,
        selected.value.length ? [...selected.value] : undefined,
        {
          onStatus: (p, msg) => {
            phase.value = p
            // Clear prior retrieve copy when entering generating (no message).
            statusMessage.value = typeof msg === 'string' ? msg : ''
          },
          onDelta: (t) => {
            assistant.content += t
            void scrollBottom()
          },
          onDone: (payload) => {
            assistant.content = payload.answer || assistant.content
            assistant.citations = payload.citations ?? []
            assistant.aiInterpretation = payload.aiInterpretation ?? null
            assistant.streaming = false
            phase.value = ''
            statusMessage.value = ''
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
        error.value = e instanceof Error ? e.message : 'Lỗi hỏi đáp CBETA'
        assistant.content = assistant.content || 'Xin lỗi, không nhận được câu trả lời.'
      }
      assistant.streaming = false
    } finally {
      busy.value = false
      phase.value = ''
      statusMessage.value = ''
      assistant.streaming = false
      await scrollBottom()
    }
  }

  onMounted(async () => {
    conversations.value = loadCbetaConversations()
    if (!conversations.value.length) createConversation()
    else {
      activeId.value = conversations.value[0].id
      messages.value = conversations.value[0].messages.map((m) => ({ ...m }))
      selected.value = [...(conversations.value[0].collections || [])]
    }
    try {
      collections.value = await fetchCbetaCollections()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Không tải được danh sách bộ CBETA'
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
  }
}
