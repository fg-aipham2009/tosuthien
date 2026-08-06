"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askChatStream, fetchRagSources } from "../lib/library/api";
import {
  loadConversations,
  newConversationId,
  saveConversations,
  titleFromMessages,
  type Conversation,
} from "../lib/library/chatHistory";
import { mergeCitationsByBook } from "../lib/library/openCitation";
import type { ChatMessage, RagSource } from "../lib/library/types";

const SIDEBAR_BP = 860;

export function useMediaWide(breakpoint = SIDEBAR_BP) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= breakpoint);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return wide;
}

export function useHoiDapChat(listRef: React.RefObject<HTMLElement | null>) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [sources, setSources] = useState<RagSource[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState<string[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const persistPaused = useRef(false);

  const active = conversations.find((c) => c.id === activeId);
  const title = active?.title || "Hỏi đáp kinh sách";

  const filterLabel =
    !selected.length
      ? "Tất cả sách"
      : selected.length === 1
        ? sources.find((s) => s.sourceFile === selected[0])?.title ?? "1 sách"
        : selected.length <= 3
          ? selected
              .map((f) => sources.find((s) => s.sourceFile === f)?.title ?? f)
              .join(" · ")
          : `${selected.length} sách`;

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [listRef]);

  const persist = useCallback(() => {
    if (!activeId) return;
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === activeId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        title: titleFromMessages(messages),
        updatedAt: Date.now(),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          citations: m.citations,
          aiInterpretation: m.aiInterpretation,
          disclaimer: m.disclaimer,
        })),
        sourceFiles: [...selected],
      };
      const sorted = next.sort((a, b) => b.updatedAt - a.updatedAt);
      saveConversations(sorted);
      return sorted;
    });
  }, [activeId, messages, selected]);

  useEffect(() => {
    if (persistPaused.current) return;
    persist();
  }, [messages, selected, persist]);

  const createConversation = useCallback((select = true) => {
    const c: Conversation = {
      id: newConversationId(),
      title: "Hội thoại mới",
      updatedAt: Date.now(),
      messages: [],
      sourceFiles: [],
    };
    setConversations((prev) => {
      const next = [c, ...prev];
      saveConversations(next);
      return next;
    });
    if (select) {
      persistPaused.current = true;
      setActiveId(c.id);
      setMessages([]);
      setSelected([]);
      persistPaused.current = false;
    }
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      persist();
      const c = conversations.find((x) => x.id === id);
      if (!c) return;
      persistPaused.current = true;
      setActiveId(c.id);
      setMessages(c.messages.map((m) => ({ ...m })));
      setSelected([...c.sourceFiles]);
      persistPaused.current = false;
      setDrawerOpen(false);
      setError("");
    },
    [conversations, persist],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (!confirm("Xóa hội thoại này? Không thể khôi phục.")) return;
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        saveConversations(next);
        return next;
      });
      if (activeId === id) {
        const rest = conversations.filter((c) => c.id !== id);
        if (rest[0]) selectConversation(rest[0].id);
        else createConversation();
      }
    },
    [activeId, conversations, createConversation, selectConversation],
  );

  const newChat = useCallback(() => {
    persist();
    createConversation();
    setDrawerOpen(false);
  }, [createConversation, persist]);

  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
    if (!loaded.length) createConversation();
    else {
      setActiveId(loaded[0].id);
      setMessages(loaded[0].messages.map((m) => ({ ...m })));
      setSelected([...loaded[0].sourceFiles]);
    }
    fetchRagSources()
      .then((s) => setSources(s.filter((x) => !!x.sourceFile)))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Không tải được danh sách sách"),
      )
      .finally(() => setSourcesLoading(false));
    return () => {
      abortRef.current?.abort();
      persist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const send = useCallback(async (questionOverride?: string) => {
    const q = (questionOverride ?? input).trim();
    if (!q || busy) return;
    setError("");
    if (!questionOverride) setInput("");
    const userMsg: ChatMessage = { role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    const history = messages;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true, citations: [] },
    ]);
    setBusy(true);
    setPhase("retrieving");
    scrollBottom();

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      await askChatStream(
        q,
        history,
        selected.length ? [...selected] : undefined,
        {
          onStatus: setPhase,
          onDelta: (t) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + t };
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
          onError: (m) => setError(m),
        },
        abortRef.current.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Lỗi hỏi đáp");
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.streaming) {
            copy[copy.length - 1] = {
              ...last,
              streaming: false,
              content: last.content || "Xin lỗi, không nhận được câu trả lời.",
            };
          }
          return copy;
        });
      }
    } finally {
      setBusy(false);
      setPhase("");
      scrollBottom();
    }
  }, [busy, input, messages, scrollBottom, selected]);

  return {
    conversations,
    activeId,
    sources,
    selected,
    messages,
    input,
    setInput,
    phase,
    busy,
    error,
    sourcesLoading,
    drawerOpen,
    setDrawerOpen,
    pickerOpen,
    setPickerOpen,
    pickerDraft,
    setPickerDraft,
    title,
    filterLabel,
    selectConversation,
    deleteConversation,
    newChat,
    clearError: () => setError(""),
    openPicker: () => {
      setPickerDraft([...selected]);
      setPickerOpen(true);
    },
    applyPicker: () => {
      setSelected([...pickerDraft]);
      setPickerOpen(false);
    },
    clearFilter: () => setSelected([]),
    clearPickerDraft: () => setPickerDraft([]),
    togglePickerDraft: (file: string) => {
      setPickerDraft((prev) =>
        prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file],
      );
    },
    send,
  };
}
