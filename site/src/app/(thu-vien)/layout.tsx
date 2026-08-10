import { LibrarySubNav } from "../../components/library/LibrarySubNav";
import { SectionTitle } from "../../components/SectionTitle";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Thư Viện",
  description:
    "Thư viện Tông Phong Tổ Sư Thiền — hỏi đáp kinh sách, pháp âm MP3, kinh sách online trên tosuthien.com.",
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
        {children}
      </div>
    </div>
  );
}
