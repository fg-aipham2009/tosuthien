import Link from "next/link";
import { SectionTitle } from "../components/SectionTitle";
import { buildMetadata } from "../lib/seo";

export const metadata = buildMetadata({
  title: "Không tìm thấy trang",
  path: "/404",
  description:
    "Trang không tồn tại trên tosuthien.com — quay về trang chủ Tổ Sư Thiền.",
  noIndex: true,
});

const QUICK_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/tin-tuc", label: "Tin tức" },
  { href: "/hoi-dap", label: "Hỏi đáp" },
  { href: "/kinh-sach", label: "Kinh sách" },
  { href: "/phap-am", label: "Pháp âm" },
  { href: "/thien-duong", label: "Thiền đường" },
  { href: "/lien-he", label: "Liên hệ" },
] as const;

function EnsoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden
      className={className}
      fill="none"
    >
      <circle
        cx="60"
        cy="60"
        r="46"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="248 42"
        strokeDashoffset="18"
        opacity="0.85"
      />
      <circle
        cx="60"
        cy="60"
        r="46"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
      />
    </svg>
  );
}

export default function NotFoundPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden py-10 md:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgb(97_34_0_/_0.07),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-32 size-64 rounded-full bg-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-20 size-48 rounded-full bg-primary/5 blur-2xl"
      />

      <div className="relative mx-auto w-full max-w-[720px] px-4 text-center animate-fade-up">
        <div className="relative mx-auto mb-6 grid size-36 place-items-center md:size-44">
          <EnsoMark className="absolute inset-0 size-full text-primary/35" />
          <span className="relative font-serif text-5xl font-light tracking-[0.2em] text-primary/25 md:text-6xl">
            404
          </span>
        </div>

        <SectionTitle as="h1" variant="bold-center" className="mb-6">
          Không tìm thấy trang
        </SectionTitle>

        <p className="mx-auto max-w-lg text-lg leading-relaxed text-ink">
          Trên đường tu, đôi khi ta rẽ nhầm một nhánh nhỏ. Trang quý vị mở có thể
          đã dời, đổi tên hoặc chưa từng có trên{" "}
          <span className="font-medium text-primary">Tổ Sư Thiền</span>.
        </p>
        <p className="mx-auto mt-3 max-w-md text-base italic leading-relaxed text-muted">
          Hãy dừng lại một chút — quay về nơi an tịnh, rồi chọn hướng đi tiếp theo.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-w-[200px] items-center justify-center rounded-[11px] bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-primary/25 transition hover:brightness-110"
          >
            Về trang chủ
          </Link>
          <Link
            href="/hoi-dap"
            className="inline-flex min-w-[200px] items-center justify-center rounded-[11px] border border-primary/25 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:border-primary/45 hover:bg-paper-warm"
          >
            Hỏi đáp kinh sách
          </Link>
        </div>

        <nav
          aria-label="Liên kết nhanh"
          className="mx-auto mt-12 max-w-xl rounded-[14px] border border-line bg-paper/80 px-5 py-6 shadow-sm shadow-primary/5 backdrop-blur-sm"
          style={{ animationDelay: "90ms" }}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
            Các trang thường dùng
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {QUICK_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-block rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-primary/30 hover:text-primary"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
