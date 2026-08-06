import { LibrarySubNav } from "../../components/library/LibrarySubNav";
import { SectionTitle } from "../../components/SectionTitle";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Thư Viện",
  path: "/hoi-dap",
  description:
    "Hỏi đáp kinh sách Tổ Sư Thiền, nghe pháp âm MP3, đọc kinh sách bản chữ và PDF gốc.",
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
