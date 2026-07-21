import type { ChatMessage } from '../types'

export interface Conversation {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
  sourceFiles: string[]
}

const KEY = 'tosuthien_chat_conversations_v1'

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Conversation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveConversations(items: Conversation[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function newConversationId(): string {
  return crypto.randomUUID()
}

export function titleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first?.content.trim()) return 'Hội thoại mới'
  const t = first.content.trim().replace(/\s+/g, ' ')
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}
