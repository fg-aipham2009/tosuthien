"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useHoiDapChat, useMediaWide } from "../../hooks/useHoiDapChat";
import { LoadingBlock, Spinner } from "../ui/Spinner";
import { useToast } from "../ui/ToastProvider";
import {
  defaultFilePage,
  mergeCitationsByBook,
  resolveCitationPdfFileUrl,
  scriptureOnly,
  tappablePages,
} from "../../lib/library/openCitation";
import type { ChatCitation, ChatMessage } from "../../lib/library/types";

const SUGGESTIONS = [
  "Tổ sư thiền là gì?",
  "Khán thoại đầu như thế nào?",
  "Pháp tham thiền của Hòa thượng Duy Lực",
];

export function HoiDapPanel() {
  const listRef = useRef<HTMLDivElement>(null);
  const wide = useMediaWide();
  const chat = useHoiDapChat(listRef);
  const toast = useToast();
  const lastError = useRef("");

  useEffect(() => {
    if (chat.error && chat.error !== lastError.current) {
      toast.error(chat.error);
      lastError.current = chat.error;
    }
    if (!chat.error) lastError.current = "";
  }, [chat.error, toast]);

  function onSuggest(text: string) {
    void chat.send(text);
  }

  const sidebar = (
    <ChatSidebar
      conversations={chat.conversations}
      activeId={chat.activeId}
      onNew={chat.newChat}
      onSelect={chat.selectConversation}
      onDelete={chat.deleteConversation}
      onCollapse={() => {
        if (wide) chat.setDrawerOpen(false);
        else chat.setDrawerOpen(false);
      }}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 items-stretch self-stretch">
      {wide ? sidebar : null}

      {!wide && chat.drawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-black/45"
          aria-label="Đóng menu"
          onClick={() => chat.setDrawerOpen(false)}
        />
      ) : null}
      {!wide ? (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[min(280px,86vw)] bg-[var(--c-sidebar)] shadow-xl transition-transform duration-200 ${
            chat.drawerOpen ? "translate-x-0" : "-translate-x-[105%]"
          }`}
          aria-hidden={!chat.drawerOpen}
        >
          {sidebar}
        </aside>
      ) : null}

      <section className="relative flex min-w-0 flex-1 flex-col bg-[var(--c-surface)]">
        {chat.sourcesLoading ? (
          <LoadingBlock label="Đang tải thư viện kinh sách…" className="min-h-[280px] flex-1" />
        ) : (
          <>
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--c-outline)] px-3 py-2.5">
          {!wide && (
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--c-primary)] hover:bg-[var(--c-surface-mid)]"
              onClick={() => chat.setDrawerOpen(true)}
            >
              ☰
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{chat.title}</h2>
          <button
            type="button"
            className="rounded-full border border-[var(--c-outline)] px-3 py-1 text-sm font-semibold text-[var(--c-primary)] hover:bg-[var(--c-surface-mid)]"
            onClick={chat.newChat}
          >
            ＋ Mới
          </button>
        </header>

        <div
          ref={listRef}
          className={`min-h-0 flex-1 overflow-y-auto ${!chat.messages.length ? "flex flex-col justify-center" : ""}`}
        >
          {!chat.messages.length ? (
            <ChatWelcome onSuggest={onSuggest} />
          ) : (
            <div className="mx-auto w-full max-w-[var(--c-col)] px-4 py-3 pb-6">
              {chat.messages.map((m, i) => (
                <ChatMessageBubble key={i} message={m} />
              ))}
              {(chat.busy || chat.phase) && (
                <div className="flex items-center justify-center gap-2.5 py-4 text-sm text-[var(--c-muted)]">
                  <Spinner size="sm" variant="muted" />
                  <span>
                    {chat.phase === "retrieving" ? "Đang tìm kinh sách…" : "Đang trả lời…"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-2">
          <div className="mx-auto w-full max-w-[var(--c-col)] px-4 pb-3">
            <BookFilterBar
              label={chat.filterLabel}
              selectedCount={chat.selected.length}
              onOpen={chat.openPicker}
              onClear={chat.clearFilter}
            />
            <Composer
              value={chat.input}
              busy={chat.busy}
              onChange={chat.setInput}
              onSend={() => void chat.send()}
            />
            <p className="mt-2 text-center text-[0.72rem] leading-snug text-[var(--c-muted)]">
              {chat.selected.length
                ? `Đang khóa ${chat.selected.length} sách — Enter gửi · Shift+Enter xuống dòng`
                : "Enter gửi · Shift+Enter xuống dòng · “Lọc sách” để giới hạn nguồn"}
            </p>
          </div>
        </footer>
          </>
        )}
      </section>

      {chat.pickerOpen ? (
        <BookPickerModal
          sources={chat.sources}
          draft={chat.pickerDraft}
          onToggle={chat.togglePickerDraft}
          onClose={() => chat.setPickerOpen(false)}
          onApply={() => {
            chat.applyPicker();
            toast.success("Đã áp dụng bộ lọc sách");
          }}
          onClearAll={chat.clearPickerDraft}
        />
      ) : null}
    </div>
  );
}

function ChatSidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  onCollapse,
}: {
  conversations: { id: string; title: string }[];
  activeId: string;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
}) {
  return (
    <div className="flex min-h-full w-[220px] shrink-0 flex-col self-stretch bg-[var(--c-sidebar)] text-[var(--c-sidebar-on)]">
      <div className="flex items-center gap-1 px-2.5 pt-3 pb-1">
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg hover:bg-[var(--c-sidebar-hover)]"
          title="Thu gọn"
          onClick={onCollapse}
        >
          ☰
        </button>
        <button
          type="button"
          className="flex flex-1 items-center gap-1 rounded-lg border border-white/10 px-2 py-2 text-sm hover:bg-[var(--c-sidebar-hover)]"
          onClick={onNew}
        >
          <span aria-hidden>＋</span> Hội thoại mới
        </button>
      </div>
      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--c-sidebar-muted)]">
        Gần đây
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {conversations.map((c) => (
          <li key={c.id} className="group relative mb-0.5">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                c.id === activeId
                  ? "bg-[var(--c-sidebar-hover)] font-semibold"
                  : "hover:bg-[var(--c-sidebar-hover)]"
              }`}
            >
              <span className="line-clamp-2">{c.title}</span>
            </button>
            <button
              type="button"
              className="absolute top-1/2 right-1 hidden size-7 -translate-y-1/2 place-items-center rounded-md text-lg group-hover:grid hover:bg-white/10"
              title="Xóa"
              onClick={() => onDelete(c.id)}
            >
              ×
            </button>
          </li>
        ))}
        {!conversations.length ? (
          <li className="px-3 text-sm text-[var(--c-sidebar-muted)]">Chưa có hội thoại</li>
        ) : null}
      </ul>
    </div>
  );
}

function ChatWelcome({ onSuggest }: { onSuggest: (t: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--c-col)] flex-col items-center gap-7 px-4 py-8 text-center">
      <div>
        <Image
          src="/wp/header-right.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto mb-4 rounded-full shadow-md"
        />
        <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Tôi có thể giúp gì cho bạn?
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--c-muted)]">
          Hỏi về giáo lý, ngữ lục và kinh sách Hòa thượng Thích Duy Lực.
        </p>
      </div>
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="rounded-full border border-[var(--c-outline)] bg-[var(--c-surface)] px-4 py-2 text-sm transition hover:border-[var(--c-primary)]/30 hover:bg-[var(--c-surface-mid)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function BookFilterBar({
  label,
  selectedCount,
  onOpen,
  onClear,
}: {
  label: string;
  selectedCount: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`mb-2.5 flex cursor-pointer items-center gap-2 rounded-[14px] border px-3 py-2.5 text-left ${
        selectedCount > 0
          ? "border-transparent bg-[var(--c-secondary-container)] text-[var(--c-on-secondary-container)]"
          : "border-[var(--c-outline)] bg-[var(--c-surface-mid)]"
      }`}
    >
      <span className="shrink-0 text-[var(--c-primary)]">{selectedCount ? "▽" : "☰"}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm">Lọc sách: {label}</strong>
        <small className="block text-xs opacity-90">
          {selectedCount
            ? `Đang lọc ${selectedCount} sách — giữ qua các lượt hỏi`
            : "Bấm để chọn sách. Chưa chọn = toàn bộ kho."}
        </small>
      </span>
      {selectedCount > 0 ? (
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          ×
        </button>
      ) : (
        <span className="shrink-0 opacity-60">▾</span>
      )}
    </div>
  );
}

function Composer({
  value,
  busy,
  onChange,
  onSend,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="flex items-end gap-1 rounded-3xl border border-black/12 bg-white px-1 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.06)] focus-within:border-[var(--c-primary)]/35"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <textarea
        value={value}
        rows={1}
        disabled={busy}
        placeholder="Nhập câu hỏi…"
        className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-base outline-none"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--c-primary)] text-white disabled:bg-[var(--c-surface-high)] disabled:text-[var(--c-muted)]"
        aria-busy={busy}
      >
        {busy ? (
          <Spinner size="sm" variant="light" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 19V5M5 12l7-7 7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </form>
  );
}

function BookPickerModal({
  sources,
  draft,
  onToggle,
  onClose,
  onApply,
  onClearAll,
}: {
  sources: { sourceFile: string; title: string }[];
  draft: string[];
  onToggle: (f: string) => void;
  onClose: () => void;
  onApply: () => void;
  onClearAll: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6"
      onClick={onClose}
      onKeyDown={() => {}}
      role="presentation"
    >
      <div
        className="flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-label="Chọn sách để hỏi"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Chọn sách để hỏi</h3>
          <button type="button" className="text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="border-b px-4 py-2 text-sm text-[var(--c-muted)]">
          {draft.length
            ? `Đã chọn ${draft.length} sách — câu hỏi tiếp theo chỉ lấy từ các sách này.`
            : "Chưa chọn → hỏi trong toàn bộ kho."}
        </p>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {sources.map((s) => (
            <li key={s.sourceFile} className="border-b border-[var(--c-outline)] last:border-0">
              <label className="flex cursor-pointer gap-2 px-2 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.includes(s.sourceFile)}
                  onChange={() => onToggle(s.sourceFile)}
                />
                <span>
                  {s.title}
                  <small className="block text-xs text-[var(--c-muted)]">{s.sourceFile}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <footer className="flex items-center justify-between border-t px-4 py-3">
          <button type="button" className="text-sm font-semibold text-[var(--c-primary)]" onClick={onClearAll}>
            Tất cả sách
          </button>
          <div className="flex gap-2">
            <button type="button" className="px-3 py-1.5 text-sm" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              className="rounded-full bg-[var(--c-primary)] px-4 py-1.5 text-sm font-semibold text-white"
              onClick={onApply}
            >
              Áp dụng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const toast = useToast();
  if (message.role === "user") {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-[var(--c-primary)] px-4 py-2.5 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const scripture = scriptureOnly(message.content || "");
  const ai = message.aiInterpretation?.trim() || "";
  const citations = mergeCitationsByBook(message.citations ?? []);

  return (
    <article className="mb-6 flex gap-3">
      <Image
        src="/wp/header-right.png"
        alt=""
        width={28}
        height={28}
        className="mt-1 size-7 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1 space-y-3">
        {(scripture || message.streaming) && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-[var(--c-primary)]">
                Nguyên văn kinh sách
              </span>
              {!message.streaming && scripture ? (
                <button
                  type="button"
                  className="text-xs text-[var(--c-muted)] hover:text-[var(--c-primary)]"
                  onClick={() => {
                    void navigator.clipboard.writeText(scripture).then(
                      () => toast.success("Đã sao chép nguyên văn"),
                      () => toast.error("Không sao chép được"),
                    );
                  }}
                >
                  Sao chép
                </button>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {scripture || (message.streaming ? "…" : "")}
            </p>
          </div>
        )}
        {citations.length > 0 ? (
          <section>
            <h4 className="mb-2 text-sm font-bold text-[var(--c-primary)]">
              Kinh sách trích dẫn ({citations.length})
            </h4>
            <ul className="space-y-2">
              {citations.map((c, j) => (
                <CitationRow key={c.passageId || j} citation={c} />
              ))}
            </ul>
          </section>
        ) : null}
        {ai ? (
          <div className="rounded-xl border border-[var(--c-outline)] bg-[var(--c-surface-low)] p-3">
            <p className="mb-1 text-xs font-bold uppercase text-[var(--c-muted)]">AI diễn giải</p>
            <p className="whitespace-pre-wrap text-base leading-relaxed">{ai}</p>
          </div>
        ) : null}
        {message.disclaimer ? (
          <p className="text-sm text-[var(--c-muted)]">{message.disclaimer}</p>
        ) : null}
      </div>
    </article>
  );
}

function CitationRow({ citation: c }: { citation: ChatCitation }) {
  const pages = tappablePages(c);
  const canOpen = !!(c.pdf?.pdfFileId || c.sourceFile);

  async function openPage(filePage: number) {
    const href = await resolveCitationPdfFileUrl(c, filePage);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="rounded-xl border border-[var(--c-outline)] bg-white p-3 text-sm">
      <strong>{c.label || c.title || "Kinh sách"}</strong>
      {pages.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {pages.map((p) => (
            <button
              key={p.printed}
              type="button"
              disabled={!canOpen}
              className="rounded-full bg-[var(--c-secondary-container)] px-2.5 py-0.5 text-xs font-semibold text-[var(--c-on-secondary-container)] disabled:opacity-40"
              onClick={() => void openPage(p.filePage)}
            >
              {p.openLabel}
            </button>
          ))}
        </div>
      ) : pages.length === 1 && canOpen ? (
        <button
          type="button"
          className="mt-2 rounded-full bg-[var(--c-secondary-container)] px-2.5 py-0.5 text-xs font-semibold"
          onClick={() => void openPage(pages[0]!.filePage ?? defaultFilePage(c))}
        >
          Mở PDF
        </button>
      ) : null}
    </li>
  );
}
