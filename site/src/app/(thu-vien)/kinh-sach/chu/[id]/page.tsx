import { TextBookReaderClient } from "../../../../../components/library/TextBookReaderClient";
import { buildMetadata } from "../../../../../lib/seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return buildMetadata({
    title: "Đọc chữ",
    path: `/kinh-sach/chu/${id}`,
    noIndex: true,
  });
}

export default async function BookTextPage({ params }: Props) {
  const { id } = await params;
  return <TextBookReaderClient id={id} />;
}
