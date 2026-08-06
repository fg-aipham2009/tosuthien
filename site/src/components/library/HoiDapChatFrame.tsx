"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { LibrarySubNav } from "./LibrarySubNav";

/** Khung chat hẹp hơn trang thư viện + min-height viewport cho vùng chat. */
export function HoiDapChatFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("hoi-dap-page");
    return () => document.body.classList.remove("hoi-dap-page");
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col px-[15px] pb-2">
      <LibrarySubNav />
      <div className="chat-theme flex min-h-[min(720px,calc(100dvh-17rem))] flex-1 flex-col overflow-hidden rounded-2xl border border-line shadow-[0_8px_32px_rgba(0,0,0,0.08)] [--c-col:min(34rem,100%)] min-[850px]:min-h-[calc(100dvh-19rem)]">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
