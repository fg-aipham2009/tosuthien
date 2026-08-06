type Variant = "center" | "bold-center";
type Tone = "primary" | "danger" | "danger-dark";

const TONE: Record<Tone, { text: string; rule: string }> = {
  primary: { text: "text-primary", rule: "bg-primary/20" },
  danger: { text: "text-danger", rule: "bg-danger/25" },
  "danger-dark": { text: "text-danger-dark", rule: "bg-danger-dark/25" },
};

/**
 * Tiêu đề mục kiểu Flatsome: chữ giữa, hai bên đường kẻ — thuần Tailwind.
 */
export function SectionTitle({
  children,
  tone = "primary",
  variant = "center",
  as: Tag = "h2",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  variant?: Variant;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const bold = variant === "bold-center";
  const { text, rule } = TONE[tone];

  return (
    <div className={`mx-auto max-w-[1080px] px-4 ${className}`}>
      <Tag className="flex items-center gap-4">
        <span aria-hidden className={`h-px flex-1 ${rule}`} />
        <span
          className={`text-center font-bold uppercase leading-tight tracking-wide ${text} ${
            bold ? "text-2xl md:text-[1.75rem]" : "text-xl md:text-2xl"
          }`}
        >
          {children}
        </span>
        <span aria-hidden className={`h-px flex-1 ${rule}`} />
      </Tag>
    </div>
  );
}
