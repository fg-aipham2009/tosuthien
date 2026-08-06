import type { ReactNode } from "react";
import { HoiDapChatFrame } from "../../components/library/HoiDapChatFrame";
import { SectionTitle } from "../../components/SectionTitle";
import "../../components/library/chat/chat-theme.css";

export default function HoiDapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col py-8">
      <SectionTitle as="h1">Thư Viện</SectionTitle>
      <HoiDapChatFrame>{children}</HoiDapChatFrame>
    </div>
  );
}
