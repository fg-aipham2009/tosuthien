import type { ReactNode } from "react";
import "../../../components/library/chat/chat-theme.css";

export default function HoiDapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="chat-theme -mx-[15px] overflow-hidden rounded-2xl border border-line bg-white shadow-sm sm:mx-0 min-h-[min(720px,calc(100dvh-320px))]">
      {children}
    </div>
  );
}
