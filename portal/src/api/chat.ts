import http from './http'
import { API_BASE } from '../config'
import type { ChatCitation, ChatMessage, RagSource } from '../types'

export async function fetchSources(): Promise<RagSource[]> {
  const { data } = await http.get<RagSource[]>('/rag/sources')
  return data
}

export type StreamHandlers = {
  onStatus?: (phase: string) => void
  onDelta?: (text: string) => void
  onDone?: (payload: {
    answer: string
    aiInterpretation?: string | null
    citations: ChatCitation[]
    disclaimer?: string
  }) => void
  onError?: (message: string) => void
}

/** POST SSE chat stream (EventSource cannot POST). */
export async function askStream(
  question: string,
  history: ChatMessage[],
  sourceFiles: string[] | undefined,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const body = {
    question,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    ...(sourceFiles?.length ? { sourceFiles } : {}),
  }

  const res = await fetch(`${API_BASE}/rag/chat/stream`, {
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

function parseSseBlock(block: string, handlers: StreamHandlers) {
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
  if (type === 'status') handlers.onStatus?.(String(payload.phase ?? ''))
  else if (type === 'delta') handlers.onDelta?.(String(payload.text ?? ''))
  else if (type === 'done') {
    handlers.onDone?.({
      answer: String(payload.answer ?? ''),
      aiInterpretation: (payload.aiInterpretation as string | null | undefined) ?? null,
      citations: (payload.citations as ChatCitation[]) ?? [],
      disclaimer: payload.disclaimer as string | undefined,
    })
  } else if (type === 'error') {
    handlers.onError?.(String(payload.message ?? 'Lỗi chat'))
  }
}
