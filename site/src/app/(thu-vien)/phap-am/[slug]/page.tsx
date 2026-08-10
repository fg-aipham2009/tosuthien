import { Suspense } from "react";
import { PhapAmAlbumClient } from "../../../../components/library/PhapAmAlbumClient";
import { DelayedLoadingBlock } from "../../../../components/ui/DelayedLoading";
import { API_BASE } from "../../../../lib/api";
import type { MediaCategory } from "../../../../lib/library/types";
import { buildMetadata } from "../../../../lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  let title = "Pháp Âm";
  try {
    const res = await fetch(`${API_BASE}/media/categories`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const cats = (await res.json()) as MediaCategory[];
      const cat = cats.find((c) => c.slug === slug);
      if (cat?.name) title = cat.name;
    }
  } catch {
    /* giữ title mặc định */
  }
  return buildMetadata({
    title,
    path: `/phap-am/${slug}`,
    description: `Nghe pháp âm MP3 — ${title}. Tông Phong Tổ Sư Thiền.`,
  });
}

export default async function PhapAmAlbumPage({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={<DelayedLoadingBlock label="Đang tải pháp âm…" />}
    >
      <PhapAmAlbumClient slug={slug} />
    </Suspense>
  );
}
