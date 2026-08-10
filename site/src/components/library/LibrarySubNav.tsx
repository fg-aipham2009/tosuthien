"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hoi-dap", label: "Hỏi Đáp" },
  { href: "/phap-am", label: "Pháp Âm" },
  { href: "/kinh-sach", label: "Kinh Sách" },
] as const;

export function LibrarySubNav({
  compact = false,
  onDark = false,
}: {
  compact?: boolean;
  onDark?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={
        compact
          ? "flex flex-wrap justify-end gap-1.5"
            : "mb-8 flex flex-wrap justify-center gap-2 text-base"
      }
      aria-label="Thư viện"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full font-semibold uppercase tracking-wide transition ${
              compact ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm"
            } ${
              active
                ? onDark
                  ? "bg-white text-primary"
                  : "bg-primary text-white"
                : onDark
                  ? "border border-white/35 text-white hover:bg-white/10"
                  : "border border-line bg-white text-ink hover:border-primary hover:text-primary"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
