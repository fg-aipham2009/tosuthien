"use client";

import type { ReactNode } from "react";
import { LibrarySubNav } from "./LibrarySubNav";

/** Chat shell — taller on phone/tablet so content does not feel cramped. */
export function HoiDapChatFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col px-[15px] pb-2">
      <LibrarySubNav />
      <div className="chat-theme flex h-[min(680px,calc(100dvh-13rem))] min-h-[min(520px,62dvh)] max-h-[min(820px,calc(100dvh-9rem))] flex-col overflow-hidden rounded-2xl border border-line shadow-[0_8px_32px_rgba(0,0,0,0.08)] [--c-col:min(34rem,100%)] sm:min-h-[560px]">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
