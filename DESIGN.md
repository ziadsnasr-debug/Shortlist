# Design

Source of truth for tokens is `app/globals.css`; this file explains them. Plan and rationale: `docs/ui-ux-plan.md`.

## Visual theme

Light first, with a tuned dark theme selected by `next-themes` (`data-theme` on `<html>`, following the system until a user chooses). Sober greys, at the owner's request on 2 October 2026 (a recorded deviation from the spec's navy and teal): graphite actions, charcoal navigation, neutral surfaces. Colour appears only where it carries meaning: muted ochre for blocking warnings and muted brick for errors, always with an icon and text. Depth comes from tonal steps, 1px borders and a whisper of shadow (`--shadow-xs`); floating layers use `--shadow-overlay`.

## Colour

Neutrals carry a faint cool cast. Contrast ratios were computed on 2 October 2026.

| Token                          | Light                          | Dark                           | Role                                  |
| ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------------- |
| `--background`                 | #f7f7f8                        | #0e0e10                        | Page                                  |
| `--card`                       | #fdfdfd                        | #161618                        | Panels, inputs                        |
| `--surface-2`                  | #f0f0f2                        | #1e1e21                        | Hover, wells, quotes                  |
| `--foreground`                 | #18181b (16.6:1)               | #ececee (16.4:1)               | Primary text                          |
| `--muted-foreground`           | #52525b (7.2:1)                | #a1a1aa (7.1:1)                | Secondary text                        |
| `--subtle-foreground`          | #6b6b74 (4.9:1)                | #85858e (4.9:1)                | Tertiary text                         |
| `--border` / `--border-strong` | #e4e4e7 / #d4d4d8              | #27272b / #37373c              | Structure                             |
| `--input`                      | #8e8e96 (3.2:1)                | #66666e (3.2:1)                | Form control boundary                 |
| `--primary`                    | #27272a, text #fafafa (14.3:1) | #ececee, text #18181b (15.0:1) | Primary action, selection, focus      |
| `--warning`                    | #8a6418 (5.3:1)                | #d6b46a (9.1:1)                | Blocking warnings, with icon and text |
| `--destructive`                | #a13838 (6.6:1)                | #e08a80 (7.0:1)                | Errors, destructive actions           |
| `--sidebar`                    | #161618, text #f4f4f5 (16.4:1) | #0b0b0c                        | Navigation surface                    |

Evidence scale (ordinal, never colour alone): full #27272a / #e4e4e7, partial #8e8e96 / #71717a, not evidenced #e4e4e7 / #27272b with a hatch, needs judgement muted ochre.

Rules: never raw hex in components; use the Tailwind utilities generated from these tokens. A bare `border` resolves to `--border`.

## Typography

Geist Sans for the interface and Geist Mono for scores, candidate labels and IDs, self-hosted through `next/font` (`--font-geist-sans`, `--font-geist-mono`). Weights 400, 500 and 600 only. Scale: 12 / 13 / 14 (body) / 16 / 19 / 23 / 28px. Tracking −0.03em at 28px, −0.02em at 19 to 23px, 0 for body. CV source text 15px with generous leading, capped near 68 characters. Tabular figures for every number.

## Shape and space

4px grid. Radius 6px (inputs, chips), 8px (buttons, rows), 12px (panels, sheets). No nested cards. No coloured side-stripe borders; selection uses a tinted background with a full 1px ring.

## Motion

| Token           | Value                           | Use                                     |
| --------------- | ------------------------------- | --------------------------------------- |
| `--dur-press`   | 100ms                           | Button press, scale 0.97                |
| `--dur-fast`    | 150ms                           | Hover, chips, tooltips (125ms)          |
| `--dur-base`    | 200ms                           | Popovers from their trigger, crossfades |
| `--dur-slow`    | 300ms                           | Sheets, CV-to-CV transitions            |
| `--ease-out`    | cubic-bezier(0.23, 1, 0.32, 1)  | Default                                 |
| `--ease-in-out` | cubic-bezier(0.77, 0, 0.175, 1) | On-screen movement                      |
| `--ease-drawer` | cubic-bezier(0.32, 0.72, 0, 1)  | Sheets                                  |

Only transform and opacity animate. Nothing bounces. Keyboard-repeated actions change instantly. `prefers-reduced-motion` removes movement and keeps short fades.

## Brand

The mark is three rounded bars of decreasing length, the top one brighter than the two below (`components/brand/logo.tsx`, `app/icon.svg`). It uses `currentColor` with a `--logo-accent` slot: teal on light surfaces, `--sidebar-accent` #54b9a5 on navy. The wordmark is "Shortlist" in Geist 600 at −0.02em.

## Components

shadcn (new-york) on Radix in `components/ui/`. Every interactive component defines default, hover, focus-visible, active, disabled, loading and error states. Focus is a 2px `--ring` outline with a 2px offset; any `outline-none` paired with a focus outline must also set `outline-solid` (Tailwind v4). Status chips always pair an icon with text. The local design gallery at `/design` (local synthetic mode only) shows every primitive in every state.

## Patterns in use

- Routing: every page and step has an address (`components/workflow/routes.ts`); in-app moves use `history.pushState` through one `navigate` with an unsaved-draft guard.
- Command menu: ⌘K or Ctrl+K opens "Jump to" (cmdk) for vacancies, steps, CVs, theme and help.
- Processing glyph: `components/workflow/processing.tsx`. Stages are only those the queue reports.
- Review: three zones, compact agreed rows, "Check required" rows, evidence chosen in the source, sticky action bar that states blockers, shortcuts paused while typing.
- Results: score composition bars with a cut line and tie chips, a table view as the spec fallback, contextual tie and exception fields, confirmation before finalising, a one-time finish mark.
- Lessons from testing: never change layout on pointer-down; entrance motion slides without fading so Axe and readers see full contrast; screen-reader-only text inside a horizontal scroller needs a positioned container.
