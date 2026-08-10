import { LibrarySubNav } from "../../components/library/LibrarySubNav";
import { SectionTitle } from "../../components/SectionTitle";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Thư Viện Hòa thượng Thích Duy Lực",
  description:
    "Thư viện Hòa thượng Thích Duy Lực — kinh sách Tổ Sư Thiền, pháp âm MP3 và hỏi đáp Phật pháp trên tosuthien.com.",
});

export default function ThuVienLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="py-8">
      <SectionTitle as="h1">Thư Viện</SectionTitle>
      <div className="mx-auto max-w-[1200px] px-[15px] sm:px-5">
        <LibrarySubNav />
        <div className="min-h-[min(56vh,680px)] sm:min-h-[min(52vh,720px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
