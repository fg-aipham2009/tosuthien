import { HoiDapPanel } from "../../components/library/HoiDapPanel";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Hỏi Đáp — Thư viện Hòa thượng Thích Duy Lực",
  path: "/hoi-dap",
  description:
    "Hỏi đáp Tổ Sư Thiền theo kinh sách và ngữ lục Hòa thượng Thích Duy Lực — thư viện tosuthien.com.",
});

export default function HoiDapPage() {
  return <HoiDapPanel />;
}
