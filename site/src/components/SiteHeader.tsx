"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MAIN_NAV, type NavItem } from "../lib/nav";

const STICKY_AT = 120;

function NavLink({
  item,
  className,
  children,
}: {
  item: NavItem;
  className?: string;
  children: React.ReactNode;
}) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {children}
    </Link>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <ul className="flex flex-nowrap items-center justify-center gap-x-2.5 lg:gap-x-3.5 xl:gap-x-5">
      {MAIN_NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : !item.external &&
              (item.label === "Thư Viện"
                ? pathname === "/hoi-dap" ||
                  pathname.startsWith("/hoi-dap/") ||
                  pathname === "/phap-am" ||
                  pathname.startsWith("/phap-am/") ||
                  pathname === "/kinh-sach" ||
                  pathname.startsWith("/kinh-sach/")
                : pathname === item.href.split("?")[0] ||
                    pathname.startsWith(`${item.href.split("?")[0]}/`));

        return (
          <li key={item.label} className="group relative shrink-0">
            <NavLink
              item={item}
              className={`flex items-center gap-0.5 whitespace-nowrap py-2.5 text-[11px] font-medium uppercase tracking-wide transition-colors xl:text-xs 2xl:text-sm ${
                active ? "text-success" : "text-white hover:text-success"
              }`}
            >
              {item.label}
              {item.children ? <span className="text-[10px]">▾</span> : null}
            </NavLink>

            {item.children ? (
              <div className="invisible absolute left-1/2 top-full z-50 min-w-[260px] -translate-x-1/2 pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <ul className="rounded-[10px] border-2 border-success bg-white py-2 shadow-xl">
                  {item.children.map((child) => (
                    <li key={child.label}>
                      <NavLink
                        item={child}
                        className="block px-5 py-2 text-xs font-medium uppercase tracking-wide text-ink transition-colors hover:text-primary"
                      >
                        {child.label}
                      </NavLink>
                      {child.children ? (
                        <ul className="pb-1 pl-8">
                          {child.children.map((leaf) => (
                            <li key={leaf.label}>
                              <NavLink
                                item={leaf}
                                className="block py-1.5 text-xs uppercase tracking-wide text-muted transition-colors hover:text-primary"
                              >
                                {leaf.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    document.documentElement.classList.toggle("overflow-hidden", open);
    return () => document.documentElement.classList.remove("overflow-hidden");
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity min-[850px]:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[300px] max-w-[85vw] overflow-y-auto bg-drawer transition-transform min-[850px]:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-white">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="text-2xl leading-none text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
        <nav className="pb-10">
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {MAIN_NAV.map((item) => (
              <li key={item.label}>
                <NavLink
                  item={item}
                  className="block px-5 py-3 text-sm font-medium uppercase tracking-wide text-white"
                >
                  {item.label}
                </NavLink>
                {item.children ? (
                  <ul className="border-t border-white/10 bg-black/10">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <NavLink
                          item={child}
                          className="block px-8 py-2.5 text-xs uppercase tracking-wide text-white/80"
                        >
                          {child.label}
                        </NavLink>
                        {child.children ? (
                          <ul>
                            {child.children.map((leaf) => (
                              <li key={leaf.label}>
                                <NavLink
                                  item={leaf}
                                  className="block px-12 py-2 text-xs uppercase tracking-wide text-white/60"
                                >
                                  {leaf.label}
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > STICKY_AT);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="relative z-40">
      <div className="relative h-[110px] bg-[url('/wp/header-bg.png')] bg-[length:100%_100%] bg-center bg-no-repeat min-[550px]:h-[180px]">
        <div className="mx-auto flex h-full max-w-[1080px] items-center justify-between px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wp/header-left.png"
            alt=""
            className="hidden h-[100px] w-auto object-contain min-[1150px]:block"
          />
          <Link href="/" className="flex flex-1 justify-center px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/wp/logo.png"
              alt="Tổ Sư Thiền"
              className="max-h-[90px] w-auto max-w-full object-contain min-[550px]:max-h-[150px]"
            />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wp/header-right.png"
            alt=""
            className="hidden h-[100px] w-auto object-contain min-[1150px]:block"
          />
        </div>
      </div>

      <div
        className={`hidden bg-primary min-[850px]:block ${
          stuck ? "sticky top-0 z-40 shadow-md" : ""
        }`}
      >
        <div className="mx-auto max-w-[1400px] px-3 xl:px-4">
          <DesktopNav pathname={pathname} />
        </div>
      </div>

      <div className="sticky top-0 z-40 flex items-center gap-3 bg-primary px-4 py-2 min-[850px]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white"
        >
          ☰
        </button>
        <span className="text-sm font-semibold uppercase tracking-wide text-white">
          Tông Phong Tổ Sư Thiền
        </span>
      </div>

      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
