import { Suspense } from "react";
import { KinhSachGrid } from "../../../components/library/KinhSachGrid";
import { DelayedLoadingBlock } from "../../../components/ui/DelayedLoading";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "Kinh Sách — Thư viện Hòa thượng Thích Duy Lực",
  path: "/kinh-sach",
  description:
    "Kinh sách Tổ Sư Thiền trong thư viện Hòa thượng Thích Duy Lực — đọc chữ online và bản PDF gốc trên tosuthien.com.",
});

export default function KinhSachPage() {
  return (
    <Suspense
      fallback={<DelayedLoadingBlock label="Đang tải kinh sách…" />}
    >
      <KinhSachGrid />
    </Suspense>
  );
}
