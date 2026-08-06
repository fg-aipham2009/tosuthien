import type { ReactNode } from "react";

/** Full-viewport chat shell (header/footer handled in SiteHeader / SiteFooter). */
export default function HoiDapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="chat-theme flex h-[calc(100dvh-3.25rem)] min-h-0 flex-1 flex-col overflow-hidden bg-[var(--c-surface)]">
      {children}
    </div>
  );
}
