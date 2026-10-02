"use client";
import type { AnchorHTMLAttributes } from "react";

// `force` is for moves that follow a successful save, before the draft flag
// has caught up; user-initiated navigation never sets it.
export type Navigate = (
  to: string,
  opts?: { replace?: boolean; force?: boolean },
) => boolean;

// A real link (open in new tab, copy address) that navigates in place on a
// plain click, so unsaved-draft guards run and nothing reloads.
export function NavLink({
  href,
  navigate,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  navigate: Navigate;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        navigate(href);
      }}
      {...props}
    />
  );
}
