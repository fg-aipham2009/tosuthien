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
    <div>
      <p className="mb-6 text-center text-base text-muted">
        Chọn album để nghe pháp âm trên trình duyệt.
      </p>
      {!cats.length ? (
        <p className="py-12 text-center text-muted">Chưa có album MP3.</p>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <li key={c.id} className="min-h-0">
              <Link
                href={`/phap-am/${c.slug}`}
                className="flex h-full min-h-[8.5rem] flex-col rounded-[10px] border border-line bg-white p-5 transition hover:border-primary hover:shadow-md"
              >
                <strong className="line-clamp-2 text-lg leading-snug font-bold text-black">
                  {c.name}
                </strong>
                <span
                  className={`mt-auto line-clamp-2 pt-2 text-sm leading-snug text-muted ${
                    c.description ? "" : "invisible"
                  }`}
                >
                  {c.description || "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
