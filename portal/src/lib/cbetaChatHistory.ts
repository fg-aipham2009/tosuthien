import type { ChatMessage } from '../types'

export interface CbetaConversation {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
  collections: string[]
}

const KEY = 'tosuthien_cbeta_chat_conversations_v1'

export function loadCbetaConversations(): CbetaConversation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CbetaConversation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCbetaConversations(items: CbetaConversation[]) {
  try {
    // Drop quote/excerpt — CBETA UI only needs labels + links; full text blows quota.
    const slim = items.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({
        ...m,
        citations: m.citations?.map((cite) => ({
          ...cite,
          quote: undefined,
          excerpt: undefined,
        })),
      })),
    }))
    localStorage.setItem(KEY, JSON.stringify(slim))
  } catch {
    // QuotaExceeded or private mode — keep session in memory only.
  }
}

export function newCbetaConversationId(): string {
  return crypto.randomUUID()
}

export function cbetaTitleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first?.content.trim()) return 'Hội thoại CBETA mới'
  const t = first.content.trim().replace(/\s+/g, ' ')
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}
