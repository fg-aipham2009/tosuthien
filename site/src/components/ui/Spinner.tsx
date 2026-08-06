type SpinnerSize = "sm" | "md" | "lg";
type SpinnerVariant = "primary" | "light" | "muted";

const SIZE: Record<SpinnerSize, string> = {
  sm: "size-4 border-2",
  md: "size-8 border-2",
  lg: "size-11 border-[3px]",
};

const VARIANT: Record<SpinnerVariant, string> = {
  primary: "border-primary/20 border-t-primary",
  light: "border-white/30 border-t-white",
  muted: "border-line border-t-muted",
};

/** Vòng quay thương hiệu — dùng chung site / chat / thư viện. */
export function Spinner({
  size = "md",
  variant = "primary",
  className = "",
  label,
}: {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  /** Hiển thị cho screen reader */
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label || "Đang tải"}
      className={`inline-block shrink-0 animate-spin rounded-full ${SIZE[size]} ${VARIANT[variant]} ${className}`}
    />
  );
}

export function LoadingBlock({
  label = "Đang tải…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" label={label} />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
