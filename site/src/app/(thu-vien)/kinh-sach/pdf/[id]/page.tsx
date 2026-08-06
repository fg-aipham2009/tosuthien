import { PdfReaderClient } from "../../../../../components/library/PdfReaderClient";
import { buildMetadata } from "../../../../../lib/seo";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return buildMetadata({
    title: "Đọc PDF",
    path: `/kinh-sach/pdf/${id}`,
    noIndex: true,
  });
}

export default async function BookPdfPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const initialPage = sp.page ? parseInt(sp.page, 10) : undefined;
  return <PdfReaderClient id={id} initialPage={initialPage} />;
}
