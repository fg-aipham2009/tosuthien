import type { ChatMessage, ChatCitation } from '../types'

/**
 * Wire history for CBETA POST. Caps mirror nestjs `llm.service` normalizeHistory:
 * retrieval is the source of truth; prior turns only resolve pronouns / follow-ups.
 */
const WIRE_HISTORY_MESSAGES = 6
const WIRE_HISTORY_USER_CHARS = 1_200
const WIRE_HISTORY_ASSISTANT_CHARS = 700

function citationStub(c: ChatCitation): string | null {
  const label = (c.label || c.volume || c.title || c.sourceFile || '').trim()
  const quote = (c.quote || c.excerpt || '').replace(/\s+/g, ' ').trim()
  if (quote.length >= 20 && label) {
    const clipped = quote.slice(0, 180)
    return `"${clipped}${quote.length > 180 ? '…' : ''}"\n— (${label})`
  }
  if (label) return `— (${label})`
  return null
}

/** Prefer citation stubs; else quote—cite lines; else topic line + work codes. */
function compressAssistantContent(m: ChatMessage): string {
  const stubs: string[] = []
  for (const c of m.citations ?? []) {
    if (stubs.length >= 2) break
    const s = citationStub(c)
    if (s) stubs.push(s)
  }
  if (stubs.length) {
    return stubs.join('\n\n').slice(0, WIRE_HISTORY_ASSISTANT_CHARS)
  }

  const text = (m.content ?? '').trim()
  if (!text) return ''

  const pairStubs: string[] = []
  const pairRe = /"([^"]{20,})"\s*[—–-]\s*\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = pairRe.exec(text)) !== null && pairStubs.length < 2) {
    const quote = match[1].replace(/\s+/g, ' ').trim().slice(0, 180)
    const label = match[2].trim()
    pairStubs.push(
      `"${quote}${match[1].length > 180 ? '…' : ''}"\n— (${label})`,
    )
  }
  if (pairStubs.length) {
    return pairStubs.join('\n\n').slice(0, WIRE_HISTORY_ASSISTANT_CHARS)
  }

  const citeLines = [...text.matchAll(/[—–-]\s*\(([^)]+tr\.\s*\d+[^)]*)\)/gi)]
    .map((x) => `— (${x[1].trim()})`)
  if (citeLines.length) {
    return citeLines.join('\n').slice(0, WIRE_HISTORY_ASSISTANT_CHARS)
  }

  // Long dumps (lineage / coverage): topic line + distinct work codes — not the list body.
  const topic =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''
  const works = [
    ...new Set(
      (m.citations ?? [])
        .map((c) => (c.volume || c.sourceFile || '').trim())
        .filter(Boolean),
    ),
  ]
  const worksPart = works.length ? ` [${works.join(', ')}]` : ''
  const compact = `${topic.slice(0, 200)}${worksPart}`.trim()
  if (compact) return compact.slice(0, WIRE_HISTORY_ASSISTANT_CHARS)

  return text.slice(0, WIRE_HISTORY_ASSISTANT_CHARS)
}

export function compressCbetaWireHistory(
  history: ChatMessage[],
): Array<{ role: ChatMessage['role']; content: string }> {
  return history.slice(-WIRE_HISTORY_MESSAGES).map((m) => {
    if (m.role === 'assistant') {
      return { role: m.role, content: compressAssistantContent(m) }
    }
    const raw = (m.content ?? '').trim()
    return {
      role: m.role,
      content:
        raw.length <= WIRE_HISTORY_USER_CHARS
          ? raw
          : raw.slice(0, WIRE_HISTORY_USER_CHARS),
    }
  })
}
