import { HoiDapPanel } from "../../components/library/HoiDapPanel";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Hỏi Đáp Tổ Sư Thiền",
  path: "/hoi-dap",
  description:
    "Chatbot hỏi đáp kinh sách và ngữ lục — dữ liệu từ thư viện Tổ Sư Thiền.",
});

export default function HoiDapPage() {
  return <HoiDapPanel />;
}
