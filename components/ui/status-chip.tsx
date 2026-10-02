import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * One chip for every state. Text stays in the foreground colour on a tinted
 * background (so 4.5:1 holds in both themes); the tone shows in the tint and
 * the icon. Colour is never the only signal: an icon and a label always render.
 */
const statusChipVariants = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 [&_svg]:text-muted-foreground",
        accent: "border-primary/30 bg-primary/15 [&_svg]:text-primary",
        success: "border-success/30 bg-success/15 [&_svg]:text-success",
        warning: "border-warning/40 bg-warning/15 [&_svg]:text-warning",
        danger:
          "border-destructive/30 bg-destructive/15 [&_svg]:text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface StatusChipProps
  extends
    Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof statusChipVariants> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function StatusChip({
  className,
  tone = "neutral",
  icon,
  children,
  ...props
}: StatusChipProps) {
  return (
    <span
      data-slot="status-chip"
      data-tone={tone}
      className={cn(statusChipVariants({ tone }), className)}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}

export { StatusChip, statusChipVariants };
