import { API_BASE } from "../api";
import { getDeviceId } from "./device";
import type {
  BookPdf,
  ChatCitation,
  ChatMessage,
  MediaCategory,
  Mp3Track,
  RagSource,
  TextBook,
  TextBookPage,
} from "./types";

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const cacheOpts =
    method === "GET" && typeof window === "undefined"
      ? { next: { revalidate: 60 } }
      : method === "GET"
        ? { cache: "no-store" as const }
        : {};
  const res = await fetch(`${API_BASE}${path}`, { ...init, ...cacheOpts });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRagSources(): Promise<RagSource[]> {
  return apiJson("/rag/sources");
}

export type StreamHandlers = {
  onStatus?: (phase: string) => void;
  onDelta?: (text: string) => void;
  onDone?: (payload: {
    answer: string;
    aiInterpretation?: string | null;
    citations: ChatCitation[];
    disclaimer?: string;
  }) => void;
  onError?: (message: string) => void;
};

export async function askChatStream(
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
  };

  const res = await fetch(`${API_BASE}/rag/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      parseSseBlock(chunk, handlers);
    }
  }
  if (buffer.trim()) parseSseBlock(buffer, handlers);
}

function parseSseBlock(block: string, handlers: StreamHandlers) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }
  const type = (payload.type as string) || event;
  if (type === "status") handlers.onStatus?.(String(payload.phase ?? ""));
  else if (type === "delta") handlers.onDelta?.(String(payload.text ?? ""));
  else if (type === "done") {
    handlers.onDone?.({
      answer: String(payload.answer ?? ""),
      aiInterpretation: (payload.aiInterpretation as string | null | undefined) ?? null,
      citations: (payload.citations as ChatCitation[]) ?? [],
      disclaimer: payload.disclaimer as string | undefined,
    });
  } else if (type === "error") {
    handlers.onError?.(String(payload.message ?? "Lỗi chat"));
  }
}

export async function fetchMediaCategories(): Promise<MediaCategory[]> {
  return apiJson("/media/categories");
}

export async function fetchMp3Tracks(params: {
  category?: string;
  folder?: string;
  year?: number;
}): Promise<Mp3Track[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.folder) qs.set("folder", params.folder);
  if (params.year != null) qs.set("year", String(params.year));
  return apiJson(`/mp3/tracks?${qs}`);
}

export async function fetchMp3Folders(params: {
  category?: string;
  year?: number;
}): Promise<string[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.year != null) qs.set("year", String(params.year));
  return apiJson(`/mp3/folders?${qs}`);
}

export async function fetchMp3Years(params: {
  category?: string;
  folder?: string;
}): Promise<number[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.folder) qs.set("folder", params.folder);
  return apiJson(`/mp3/years?${qs}`);
}

export async function fetchPdfs(): Promise<BookPdf[]> {
  const deviceId = getDeviceId();
  return apiJson(`/pdfs?device_id=${encodeURIComponent(deviceId)}`);
}

export async function fetchTextBooks(): Promise<TextBook[]> {
  const deviceId = getDeviceId();
  return apiJson(`/text-books?device_id=${encodeURIComponent(deviceId)}`);
}

export async function fetchTextBookPages(
  id: string,
  from: number,
  to: number,
): Promise<{ pageCount: number; pages: TextBookPage[]; title: string }> {
  const qs = new URLSearchParams({ from: String(from), to: String(to) });
  return apiJson(`/text-books/${encodeURIComponent(id)}/pages?${qs}`);
}

export async function saveReadingProgress(pdfFileId: string, lastPage: number) {
  await apiJson("/reading-progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      pdfFileId,
      lastPage,
    }),
  });
}
