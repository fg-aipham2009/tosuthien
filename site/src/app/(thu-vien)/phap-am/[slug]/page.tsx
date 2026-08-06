import { Suspense } from "react";
import { PhapAmAlbumClient } from "../../../../components/library/PhapAmAlbumClient";
import { buildMetadata } from "../../../../lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return buildMetadata({
    title: "Pháp Âm",
    path: `/phap-am/${slug}`,
    description: "Nghe pháp âm MP3 Tổ Sư Thiền.",
  });
}

export default async function PhapAmAlbumPage({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense fallback={<p className="py-12 text-center text-muted">Đang tải…</p>}>
      <PhapAmAlbumClient slug={slug} />
    </Suspense>
  );
}
