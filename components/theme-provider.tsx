"use client";
import { ThemeProvider as NextThemes } from "next-themes";

// Light is the designed default; dark follows the system until a user picks.
export function ThemeProvider({
  nonce,
  children,
}: {
  nonce?: string;
  children: React.ReactNode;
}) {
  return (
    <NextThemes
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
    </NextThemes>
  );
}
