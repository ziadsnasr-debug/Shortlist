# Design

Source of truth for tokens is `app/globals.css`; this file explains them. Plan and rationale: `docs/ui-ux-plan.md`.

## Visual theme

Light first, with a tuned dark theme selected by `next-themes` (`data-theme` on `<html>`, following the system until a user chooses). Restrained colour strategy: tinted neutrals plus one teal accent under roughly 10% of any surface. Navy navigation, light work surfaces and teal actions, as specification v1.2 §3 requires. Depth comes from tonal steps and 1px borders; shadows appear only on floating layers.

## Colour

Neutrals are tinted toward the navy hue. Contrast ratios were computed on 2 October 2026.

| Token                  | Light            | Dark             | Role                                      |
| ---------------------- | ---------------- | ---------------- | ----------------------------------------- |
| `--background`         | #f7fbfc          | #091114          | Page                                      |
| `--card`               | #fdffff          | #0f191d          | Panels, inputs                            |
| `--surface-2`          | #eff5f6          | #172125          | Hover, wells, quotes                      |
| `--foreground`         | #122228 (15.7:1) | #e5edee (16.0:1) | Primary text                              |
| `--muted-foreground`   | #49585d (7.1:1)  | #9da7a9 (7.3:1)  | Secondary text                            |
| `--subtle-foreground`  | #636e72 (5.0:1)  | #7e888b (4.9:1)  | Tertiary text                             |
| `--border`             | #dce3e5          | #253034          | Structure                                 |
| `--input`              | #838e92 (3.4:1)  | #657175 (3.5:1)  | Form control boundary                     |
| `--primary`            | #007463          | #54b9a5          | Primary action, selection, focus          |
| `--primary-foreground` | #fdffff (5.7:1)  | #051e27 (7.3:1)  | Text on primary                           |
| `--secondary`          | #dff6f0          | #12302b          | Selected rows, active step                |
| `--destructive`        | #ba3535          | #e07a6e          | Errors, destructive actions               |
| `--success`            | #2b7440          | #73c385          | Completed state (with icon and text)      |
| `--warning`            | #935a11          | #eeb154          | Attention state (with icon and text)      |
| `--sidebar`            | #051e27          | #050f13          | Navigation surface; text #e5edee (14.5:1) |

Evidence scale (ordinal, never colour alone): `--ev-full` #006e5e / #4db39e, `--ev-partial` #6bbdab / #2f7063, `--ev-none` #dadfe0 / #2d3437 with a hatch, `--ev-unclear` #f2af48 / #e8aa4e.

Rules: never raw hex in components; use the Tailwind utilities generated from these tokens (`bg-primary`, `text-muted-foreground`, `bg-surface-2`, `border-input`). A bare `border` resolves to `--border`.

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

The mark is three rounded bars of decreasing length, the top one in the accent (`components/brand/logo.tsx`, `app/icon.svg`). It uses `currentColor` with a `--logo-accent` slot: teal on light surfaces, `--sidebar-accent` #54b9a5 on navy. The wordmark is "Shortlist" in Geist 600 at −0.02em.

## Components

shadcn (new-york) on Radix in `components/ui/`. Every interactive component defines default, hover, focus-visible, active, disabled, loading and error states. Focus is a 2px `--ring` outline with a 2px offset; any `outline-none` paired with a focus outline must also set `outline-solid` (Tailwind v4). Status chips always pair an icon with text. The local design gallery at `/design` (local synthetic mode only) shows every primitive in every state.
