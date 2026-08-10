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
      <div className="overflow-hidden bg-paper-warm shadow-[0_0_0_1px_rgb(0_0_0/0.04)] transition duration-500 group-hover:shadow-[0_12px_32px_-12px_rgb(97_34_0/0.28)]">
        <div className="relative aspect-video w-full overflow-hidden">
          {center.mainImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={center.mainImageUrl}
              alt={center.templeName}
              loading="lazy"
              decoding="async"
              className="h-full w-full rounded-none object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wp/header-right.png"
                alt=""
                loading="lazy"
                decoding="async"
                className="h-16 w-16 rounded-none object-contain opacity-30"
              />
            </div>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/25 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
        </div>
      </div>

      <div className="pt-4 text-center">
        <h5 className="text-base font-bold uppercase leading-snug tracking-wide text-ink transition-colors duration-300 group-hover:text-primary">
          {title}
        </h5>
        <span className="mx-auto mt-3 block h-px w-12 bg-gold/70 transition-all duration-500 group-hover:w-full group-hover:max-w-[220px]" />
      </div>
    </Link>
  );
}
