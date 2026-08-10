import { Suspense } from "react";
import { KinhSachGrid } from "../../../components/library/KinhSachGrid";
import { DelayedLoadingBlock } from "../../../components/ui/DelayedLoading";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "Kinh Sách Tổ Sư Thiền",
  path: "/kinh-sach",
  description:
    "Kinh sách Tổ Sư Thiền — ngữ lục và đường lối tham thoại đầu giúp hành giả tu tập; đọc chữ online và PDF trên tosuthien.com.",
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
