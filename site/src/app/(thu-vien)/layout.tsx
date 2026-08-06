import { LibrarySubNav } from "../../components/library/LibrarySubNav";
import { SectionTitle } from "../../components/SectionTitle";

export default function ThuVienLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="py-8">
      <SectionTitle as="h1">Thư Viện</SectionTitle>
      <div className="mx-auto max-w-[1080px] px-[15px]">
        <LibrarySubNav />
        {children}
      </div>
    </div>
  );
}
