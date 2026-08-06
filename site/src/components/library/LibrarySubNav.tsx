"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hoi-dap", label: "Hỏi Đáp" },
  { href: "/phap-am", label: "Pháp Âm" },
  { href: "/kinh-sach", label: "Kinh Sách" },
] as const;

export function LibrarySubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-8 flex flex-wrap justify-center gap-2"
      aria-label="Thư viện"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition ${
              active
                ? "bg-primary text-white"
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
