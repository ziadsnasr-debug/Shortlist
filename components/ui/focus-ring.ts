/**
 * Shared keyboard focus treatment: a 2px ring-coloured outline with a 2px offset.
 * Tailwind v4's `outline-none` sets `--tw-outline-style: none`, so every
 * focus-visible outline must also carry `outline-solid`.
 */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";
