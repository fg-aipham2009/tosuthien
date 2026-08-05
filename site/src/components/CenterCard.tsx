import Link from "next/link";
import { centerHref } from "../lib/centers";
import type { Center } from "../lib/types";

/** Thẻ thiền đường Flatsome: ảnh 16:9, tên viết hoa giữa, gạch dưới. */
export function CenterCard({
  center,
  showProvince = true,
}: {
  center: Center;
  showProvince?: boolean;
}) {
  const title =
    showProvince && center.province
      ? `${center.templeName} – ${center.province}`
      : center.templeName;

  return (
    <Link href={centerHref(center)} className="group block">
      <div className="overflow-hidden rounded-[10px] bg-paper-warm">
        <div className="relative aspect-video w-full overflow-hidden">
          {center.mainImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={center.mainImageUrl}
              alt={center.templeName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wp/header-right.png"
                alt=""
                className="h-16 w-16 object-contain opacity-30"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 text-center">
        <h5 className="text-[15px] font-bold uppercase leading-snug tracking-wide text-ink transition-colors group-hover:text-primary">
          {title}
        </h5>
        <span className="mx-auto mt-3 block h-px w-full max-w-[220px] bg-line" />
      </div>
    </Link>
  );
}
