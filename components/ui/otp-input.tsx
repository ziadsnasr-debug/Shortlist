"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const LENGTH = 6;

export interface OtpInputProps {
  /** Digits only, up to six characters. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-describedby"?: string;
  className?: string;
}

const digitsOnly = (text: string) => text.replace(/\D/g, "").slice(0, LENGTH);

/**
 * Six separate-looking cells backed by ONE real input.
 *
 * The input is transparent and stretched over the cells, so it keeps native
 * behaviour: one label, one value for screen readers, `autocomplete=one-time-code`
 * for SMS and password-manager fill, and normal keyboard editing. The cells only
 * mirror its value and draw the caret. Non-digits are dropped and a pasted code
 * (with spaces or dashes) fills every cell. Nothing submits automatically.
 */
const OtpInput = React.forwardRef<HTMLInputElement, OtpInputProps>(
  (
    {
      value,
      onChange,
      id = "code",
      name = "code",
      disabled,
      invalid,
      autoFocus,
      className,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = React.useState(false);
    const active = Math.min(value.length, LENGTH - 1);

    // Keep the caret at the end: cells cannot show a caret mid-code. A real
    // range (select all) is left alone so the code can still be replaced.
    function pinCaret(input: HTMLInputElement) {
      const end = input.value.length;
      if (
        input.selectionStart === input.selectionEnd &&
        input.selectionStart !== end
      )
        input.setSelectionRange(end, end);
    }

    return (
      <div
        className={cn("relative w-full", className)}
        data-invalid={invalid || undefined}
      >
        <div
          aria-hidden="true"
          className="grid grid-cols-6 gap-2"
          data-slot="otp-cells"
        >
          {Array.from({ length: LENGTH }, (_, i) => {
            const isActive = focused && !disabled && i === active;
            return (
              <div
                key={i}
                data-active={isActive || undefined}
                className={cn(
                  "relative flex h-12 items-center justify-center rounded-md border border-input bg-card font-mono text-xl font-medium tabular-nums text-foreground transition-[border-color] duration-(--dur-fast) ease-(--ease-out)",
                  invalid && "border-destructive",
                  isActive &&
                    "outline-2 outline-offset-2 outline-ring outline-solid",
                  disabled && "opacity-50",
                )}
              >
                {value[i] ?? ""}
                {isActive && value.length < LENGTH && (
                  <span className="absolute inset-y-3 w-px animate-pulse bg-foreground motion-reduce:animate-none" />
                )}
              </div>
            );
          })}
        </div>
        <input
          ref={ref}
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={LENGTH}
          required
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={invalid || undefined}
          aria-describedby={rest["aria-describedby"]}
          className="absolute inset-0 size-full cursor-text border-0 bg-transparent p-0 text-transparent caret-transparent opacity-0 outline-none"
          onChange={(e) => onChange(digitsOnly(e.target.value))}
          onPaste={(e) => {
            // maxLength would truncate "123 456" before onChange sees it.
            e.preventDefault();
            onChange(digitsOnly(e.clipboardData.getData("text")));
          }}
          onFocus={(e) => {
            setFocused(true);
            pinCaret(e.currentTarget);
          }}
          onBlur={() => setFocused(false)}
          onSelect={(e) => pinCaret(e.currentTarget)}
        />
      </div>
    );
  },
);
OtpInput.displayName = "OtpInput";

export { OtpInput };
