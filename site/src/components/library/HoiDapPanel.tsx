"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  askChatStream,
  fetchRagSources,
} from "../../lib/library/api";
import {
  mergeCitationsByBook,
  resolveCitationPdfFileUrl,
  scriptureOnly,
  tappablePages,
} from "../../lib/library/openCitation";
import type { ChatCitation, ChatMessage, RagSource } from "../../lib/library/types";

export function HoiDapPanel() {
  const [sources, setSources] = useState<RagSource[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchRagSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setError("");
    setInput("");
    setBusy(true);
    setPhase("retrieving");

    const userMsg: ChatMessage = { role: "user", content: q };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      streaming: true,
      citations: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollBottom();

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const history = messages;

    try {
      await askChatStream(
        q,
        history,
        selectedFiles.length ? selectedFiles : undefined,
        {
          onStatus: setPhase,
          onDelta: (t) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + t,
                };
              }
              return copy;
            });
            scrollBottom();
          },
          onDone: (payload) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: payload.answer || last.content,
                  citations: mergeCitationsByBook(payload.citations ?? []),
                  aiInterpretation: payload.aiInterpretation ?? null,
                  disclaimer: payload.disclaimer ?? null,
                  streaming: false,
                };
              }
              return copy;
            });
            setPhase("");
            scrollBottom();
          },
          onError: (msg) => setError(msg),
        },
        abortRef.current.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Không gửi được câu hỏi");
      }
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.streaming) copy.pop();
        return copy;
      });
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  function toggleSource(file: string) {
    setSelectedFiles((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file],
    );
  }

  const filterLabel =
    !selectedFiles.length
      ? "Tất cả sách"
      : selectedFiles.length === 1
        ? sources.find((s) => s.sourceFile === selectedFiles[0])?.title ?? "1 sách"
        : `${selectedFiles.length} sách`;

  return (
    <div className="flex min-h-[520px] flex-col rounded-[10px] border border-line bg-paper md:min-h-[640px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <p className="text-sm text-muted">
          Hỏi về giáo lý, ngữ lục và kinh sách Hòa thượng Thích Duy Lực.
        </p>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-primary hover:bg-paper-warm"
        >
          {filterLabel} ▾
        </button>
      </div>

      {filterOpen ? (
        <div className="max-h-48 overflow-y-auto border-b border-line bg-white px-4 py-3">
          <button
            type="button"
            className="mb-2 text-sm font-semibold text-primary"
            onClick={() => setSelectedFiles([])}
          >
            Chọn tất cả
          </button>
          <ul className="space-y-1">
            {sources.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(s.sourceFile)}
                    onChange={() => toggleSource(s.sourceFile)}
                    className="mt-1"
                  />
                  <span>{s.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {!messages.length ? (
          <div className="py-12 text-center text-muted">
            <p className="text-base">Ví dụ: &quot;Thiền là gì?&quot;, &quot;Giải thích ngữ lục 44&quot;</p>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <MessageRow key={i} message={m} />
        ))}
        {busy && phase ? (
          <p className="text-center text-sm text-muted">Đang {phase === "retrieving" ? "tìm kinh sách…" : "trả lời…"}</p>
        ) : null}
      </div>

      {error ? (
        <p className="border-t border-line bg-alert/10 px-4 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          placeholder="Nhập câu hỏi…"
          disabled={busy}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[10px] border border-line px-3 py-2 text-base outline-none focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[10px] bg-primary px-4 py-2.5 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const scripture = scriptureOnly(message.content || "");
  const ai = message.aiInterpretation?.trim() || "";
  const citations = mergeCitationsByBook(message.citations ?? []);

  return (
    <div className="space-y-3 rounded-[10px] bg-white p-4 shadow-sm">
      {scripture || message.streaming ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-primary">Nguyên văn kinh sách</p>
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {scripture || (message.streaming ? "…" : "")}
          </p>
        </div>
      ) : null}
      {citations.length ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-primary">
            Trích dẫn ({citations.length})
          </p>
          <ul className="space-y-2">
            {citations.map((c, j) => (
              <CitationCard key={j} citation={c} />
            ))}
          </ul>
        </div>
      ) : null}
      {ai ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-muted">AI diễn giải</p>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">{ai}</p>
        </div>
      ) : null}
      {message.disclaimer ? (
        <p className="text-sm text-muted">{message.disclaimer}</p>
      ) : null}
    </div>
  );
}

function CitationCard({ citation: c }: { citation: ChatCitation }) {
  const body = (c.excerpt || c.quote || "").trim();
  const pages = tappablePages(c);

  async function openPage(filePage: number) {
    const href = await resolveCitationPdfFileUrl(c, filePage);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="rounded-[8px] border border-line bg-paper p-3 text-sm">
      <strong className="text-black">{c.label || c.title || "Kinh sách"}</strong>
      {body ? <p className="mt-1 text-ink">{body}</p> : null}
      {pages.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {pages.map((p) => (
            <button
              key={p.printed}
              type="button"
              onClick={() => void openPage(p.filePage)}
              className="rounded bg-paper-warm px-2 py-0.5 text-xs font-semibold text-primary hover:bg-success/40"
            >
              {p.openLabel}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
