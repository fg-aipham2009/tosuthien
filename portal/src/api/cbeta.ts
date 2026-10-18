import http from './http'
import { API_BASE } from '../config'
import type { ChatCitation, ChatMessage } from '../types'

export type CbetaCollection = {
  code: string
  nameZh: string
  nameVi: string
  works: number
}

export type CbetaCitationRaw = {
  chunkId: string
  workCode: string
  collection: string
  titleZh: string
  juanNo: number | null
  juanLabel: string | null
  chunkIndex: number
  label: string
  quote: string
  score: number
}

export async function fetchCbetaHealth() {
  const { data } = await http.get<{
    ok: boolean
    works?: number
    chunks?: number
    embeddings?: number
  }>('/cbeta/health')
  return data
}

export async function fetchCbetaCollections(): Promise<CbetaCollection[]> {
  const { data } = await http.get<CbetaCollection[]>('/cbeta/collections')
  return data
}

export type CbetaStreamHandlers = {
  onStatus?: (phase: string, message?: string) => void
  onDelta?: (text: string) => void
  onDone?: (payload: {
    answer: string
    aiInterpretation?: string | null
    citations: ChatCitation[]
  }) => void
  onError?: (message: string) => void
}

export function mapCbetaCitations(raw: CbetaCitationRaw[] | undefined): ChatCitation[] {
  return (raw ?? []).map((c) => ({
    passageId: c.chunkId,
    label: c.label,
    title: c.titleZh || c.workCode,
    volume: c.workCode,
    pageNum: c.juanNo,
    pageStart: c.juanNo,
    pageEnd: c.juanNo,
    sourceFile: c.workCode,
    score: c.score,
    quote: c.quote,
    excerpt: c.quote,
    pdf: null,
    openLabel: null,
  }))
}

/** POST SSE — dedicated CBETA API (never /rag). */
export async function askCbetaStream(
  question: string,
  history: ChatMessage[],
  collections: string[] | undefined,
  handlers: CbetaStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const body = {
    question,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    ...(collections?.length ? { collections } : {}),
  }

  const res = await fetch(`${API_BASE}/cbeta/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      parseSseBlock(chunk, handlers)
    }
  }
  if (buffer.trim()) parseSseBlock(buffer, handlers)
}

function parseSseBlock(block: string, handlers: CbetaStreamHandlers) {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    return
  }
  const type = (payload.type as string) || event
  if (type === 'status') {
    handlers.onStatus?.(
      String(payload.phase ?? ''),
      typeof payload.message === 'string' ? payload.message : undefined,
    )
  } else if (type === 'delta') handlers.onDelta?.(String(payload.text ?? ''))
  else if (type === 'done') {
    handlers.onDone?.({
      answer: String(payload.answer ?? ''),
      aiInterpretation: (payload.aiInterpretation as string | null | undefined) ?? null,
      citations: mapCbetaCitations(payload.citations as CbetaCitationRaw[]),
    })
  } else if (type === 'error') {
    handlers.onError?.(String(payload.message ?? 'Lỗi chat CBETA'))
  }
}
