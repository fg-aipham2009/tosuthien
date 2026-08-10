import Link from "next/link";
import { API_BASE } from "../../../lib/api";
import type { MediaCategory } from "../../../lib/library/types";
import { buildMetadata } from "../../../lib/seo";

export const metadata = buildMetadata({
  title: "Pháp Âm",
  path: "/phap-am",
  description: "Nghe MP3 khai thị, pháp thoại Tổ Sư Thiền.",
});

async function loadCategories(): Promise<MediaCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/media/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function PhapAmPage() {
  const cats = await loadCategories();

  return (
    <div className="min-h-[min(50vh,560px)]">
      <p className="mb-6 text-center text-base text-muted">
        Chọn album để nghe pháp âm trên trình duyệt.
      </p>
      {!cats.length ? (
        <p className="py-12 text-center text-muted">Chưa có album MP3.</p>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <li key={c.id} className="min-h-0">
              <Link
                href={`/phap-am/${c.slug}`}
                className="flex h-full flex-col justify-start rounded-[10px] border border-line bg-white px-3 py-2.5 transition hover:border-primary hover:shadow-sm"
              >
                <strong className="text-base leading-snug font-bold break-words whitespace-normal text-black">
                  {c.name}
                </strong>
                {c.description ? (
                  <span className="mt-1 text-sm leading-snug break-words whitespace-normal text-muted">
                    {c.description}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
