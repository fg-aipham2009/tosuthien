import { HoiDapPanel } from "../../components/library/HoiDapPanel";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Hỏi Đáp Tổ Sư Thiền",
  path: "/hoi-dap",
  description:
    "Hỏi đáp Tổ Sư Thiền — giải đáp thực hành tham thoại đầu, giúp hành giả vững bước trên đường tu tập theo tông chỉ.",
});

export default function HoiDapPage() {
  return <HoiDapPanel />;
}
