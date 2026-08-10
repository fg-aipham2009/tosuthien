import { Suspense } from "react";
import { KinhSachGrid } from "../../../components/library/KinhSachGrid";
import { DelayedLoadingBlock } from "../../../components/ui/DelayedLoading";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "Kinh Sách",
  path: "/kinh-sach",
  description:
    "Thư viện kinh sách Tổ Sư Thiền — kệ FlipHTML5, đọc chữ và PDF gốc.",
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
