import { PhapAmAlbumClient } from "../../../../components/library/PhapAmAlbumClient";
import { loadMp3Album } from "../../../../lib/library/mp3Album";
import type { MediaCategory } from "../../../../lib/library/types";
import { API_BASE } from "../../../../lib/api";
import { buildMetadata } from "../../../../lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ folder?: string; year?: string }>;
};

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
    /* keep default title */
  }
  return buildMetadata({
    title,
    path: `/phap-am/${slug}`,
    description: `Pháp âm ${title} — MP3 Tổ Sư Thiền trong thư viện Hòa thượng Thích Duy Lực.`,
  });
}

export default async function PhapAmAlbumPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const folder = query.folder?.trim() || null;
  const yearRaw = query.year;
  const selectedYear =
    yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : null;

  const album = await loadMp3Album({ slug, folder, year: selectedYear });

  return (
    <PhapAmAlbumClient
      slug={slug}
      folder={album.folder}
      selectedYear={selectedYear}
      cat={album.cat}
      folders={album.folders}
      tracks={album.tracks}
      years={album.years}
    />
  );
}
