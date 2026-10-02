import { cn } from "@/lib/utils";

// Three bars, each shorter than the last: a long list narrowed to a few.
// The top bar takes the accent; the others follow the current text colour.
export function LogoMark({
  className,
  title,
  accent = "var(--logo-accent)",
}: {
  className?: string;
  title?: string;
  accent?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="3" y="5" width="18" height="3.4" rx="1.7" fill={accent} />
      <rect
        x="3"
        y="10.3"
        width="13"
        height="3.4"
        rx="1.7"
        fill="var(--logo-rest, currentColor)"
      />
      <rect
        x="3"
        y="15.6"
        width="8"
        height="3.4"
        rx="1.7"
        fill="var(--logo-rest, currentColor)"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("logo", className)}>
      <LogoMark />
      <span>Shortlist</span>
    </span>
  );
}
