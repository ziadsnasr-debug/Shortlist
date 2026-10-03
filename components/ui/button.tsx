import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-[-0.006em] select-none",
    "transition-[transform,background-color,color,border-color,box-shadow] duration-(--dur-press) ease-(--ease-out)",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    focusRing,
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      // Filled variants draw their edge with background colour, which forced
      // colours removes, so they add a system-colour border there.
      variant: {
        // Graphite with a hairline highlight on top and a soft contact shadow.
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.16)] hover:bg-primary-hover forced-colors:border forced-colors:border-[ButtonText]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.16)] hover:bg-destructive/90 forced-colors:border forced-colors:border-[ButtonText]",
        outline:
          "border border-border-strong bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:border-input/60 hover:bg-surface-2",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted forced-colors:border forced-colors:border-[ButtonText]",
        ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        link: "text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-10 rounded-md px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Disables the button, sets aria-busy and overlays a spinner without changing its width. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));
    if (asChild) {
      return (
        <Slot
          className={classes}
          ref={ref}
          aria-busy={loading || undefined}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            {/* The label keeps its box (and stays in the accessibility tree) so the width never shifts. */}
            <span className="inline-flex items-center justify-center gap-2 opacity-0">
              {children}
            </span>
            <Loader2
              aria-hidden="true"
              className="absolute animate-spin motion-reduce:animate-none"
            />
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
