"use client";

import type { ReactNode } from "react";
import { LibrarySubNav } from "./LibrarySubNav";

/** Khung chat hẹp; chiều cao vừa phải (không chiếm gần full viewport). */
export function HoiDapChatFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col px-[15px] pb-2">
      <LibrarySubNav />
      <div className="chat-theme flex h-[min(460px,calc(100dvh-22rem))] min-h-[360px] max-h-[520px] flex-col overflow-hidden rounded-2xl border border-line shadow-[0_8px_32px_rgba(0,0,0,0.08)] [--c-col:min(34rem,100%)]">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
