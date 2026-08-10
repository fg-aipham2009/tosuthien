type Variant = "center" | "bold-center";
type Tone = "primary" | "danger" | "danger-dark";
type Size = "md" | "lg";

const TONE: Record<Tone, { text: string; rule: string }> = {
  primary: { text: "text-primary", rule: "bg-primary/20" },
  danger: { text: "text-danger", rule: "bg-danger/25" },
  "danger-dark": { text: "text-danger-dark", rule: "bg-danger-dark/25" },
};

const SIZE: Record<Size, string> = {
  md: "text-xl md:text-2xl",
  lg: "text-[1.75rem] md:text-[2.15rem]",
};

/** Flatsome-style section heading: centered label with rules on both sides. */
export function SectionTitle({
  children,
  tone = "primary",
  variant = "center",
  size = "md",
  as: Tag = "h2",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const bold = variant === "bold-center";
  const { text, rule } = TONE[tone];
  const sizeClass =
    size === "lg"
      ? SIZE.lg
      : bold
        ? "text-2xl md:text-[1.75rem]"
        : SIZE.md;

  return (
    <div className={`mx-auto max-w-[1080px] px-4 ${className}`}>
      <Tag className="flex items-center gap-4">
        <span aria-hidden className={`h-px flex-1 ${rule}`} />
        <span
          className={`text-center font-bold uppercase leading-tight tracking-wide ${text} ${sizeClass}`}
        >
          {children}
        </span>
        <span aria-hidden className={`h-px flex-1 ${rule}`} />
      </Tag>
    </div>
  );
}
