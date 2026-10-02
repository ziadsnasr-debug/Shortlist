# UI/UX uplift plan, 2 October 2026

Goal: turn the working synthetic workflow into a calm, precise, trustworthy recruiter tool that a person fluent in Linear, Stripe or Vercel would trust on first use. No feature logic, scoring rule or security gate changes. This is a presentation, flow and interaction plan.

Status: phase 0 implemented on branch `codex/ui-phase-0` (tokens, dark theme, Geist, logo, primitives, design gallery, candidate labels, PRODUCT.md and DESIGN.md). Phase 1 implemented on branch `codex/ui-phase-1`, stacked on phase 0: an address for every page and step, sidebar with progress rings and account menu (theme, help, sign out), mobile top bar with a slide-in menu, link-based stepper with locked states, vacancies list with a specific next action, new-vacancy page, role-aware actions, and redesigned sign-in and MFA. Phases 2 to 5 are proposed.

Note: PR #3 (`feat/ui-redesign`, merged 2 October 2026) landed while this plan was being written. It added an ivory/charcoal/cobalt palette, criterion weight bars, a batch progress strip, confirmed-score bars, a comparison matrix for up to three selected applications, focusable source passages and CSS motion with reduced-motion overrides. Phase 0 keeps those layouts and features and moves their colours onto the navy/teal tokens below (decision confirmed 2 October 2026). Audit items 7 and 10 are therefore partly addressed already; later phases refine rather than rebuild them.

## 0. Decisions and guardrails

| Decision                   | Choice (user, 2 Oct 2026)                                             | Consequence                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts on the results page | Override spec v1.2 §3 ("no dashboards, charts") and log the deviation | Add a row to `docs/customer-decisions.md` for customer sign-off. Keep a table view of every chart as the spec-compliant fallback.                                                                    |
| Palette                    | Refine the spec's navy navigation, white surfaces and teal actions    | Identity stays spec-safe; re-engineered in OKLCH with tinted neutrals and one accent.                                                                                                                |
| Theme                      | Light first, tuned dark mode second                                   | Scene: an in-house recruiter at a desk in office daylight, reading dense CV text for a 60 to 90 minute block and making decisions they must later justify. Light wins; dark is for evening sessions. |

These spec rules survive every change below and are acceptance criteria for each phase:

- Plain-language categories: "Full evidence", "Partial evidence", "Not evidenced in this CV", "Needs your judgement", and "AI note" beside the rationale. Never label a person as weak.
- Ranking appears only after every active application is reviewed. Names stay hidden until "Reveal names". No score column during intake.
- Status uses text and icon as well as colour. Every disabled primary button says why.
- Keyboard navigation, visible focus, Escape and focus restoration for overlays, stacked panels on narrow screens, desktop, 390px and 200% zoom. No hover-only actions, no timers that force a decision.
- Version checks still guard concurrent edits; autosave never silently overwrites another reviewer.

## 1. What is wrong today (audit of the current code)

Concrete findings from `components/workspace.tsx` (1,802 lines), `document-intake.tsx`, `app/globals.css` (1,397 lines of bespoke classes) and the live app on 2 Oct 2026:

1. **No type system.** Body is 14px Arial; headings are 30px and 19px with nothing between. No tabular figures for scores.
2. **No brand.** The "logo" is the Lucide `ListChecks` icon in a tile. The sidebar colour is a raw hex (`#102d34`) outside the token set.
3. **Candidate labels are raw UUIDs** (`CV-aacb75cb-767b-4ee6-…`), visible in the shortlist screenshot `work/live-local-final.png`. The `applications.anonymous_label` column currently stores the application id, so it is not ready. Derive a stable per-batch ordinal server-side (intake order, unchanged by disposal) and expose it, then show "Candidate 07".
4. **No URLs for steps.** Vacancy, batch and step live in React state. Refresh, back button and deep links all lose place.
5. **Mixed control vocabulary.** Native `<select>` and `<input type="checkbox">` next to shadcn inputs; Radix Checkbox is installed but unused in the workflow.
6. **Wayfinding gaps.** "Administration" is a floating outline button above the page title; "Back to workspace" is the only way out of admin.
7. **Criteria builder is a form dump.** Each criterion is a three-input grid plus "Move up" and "Remove criterion" text buttons; no undo on remove; the 100-point total is a small badge.
8. **Intake is split in two.** "Synthetic document intake" and the application list are separate panels showing overlapping rows. Status reads as raw strings ("complete · 2 attempts"). Polling is a fixed 6s.
9. **Review is heavy.** Evidence selection is a `<details>` of checkboxes listing block IDs; category is a native select; agreed and disputed criteria look identical; only Previous/Next for moving between CVs; no keyboard shortcuts.
10. **Results are a checkbox list.** No visual comparison, tie boundary not shown, tie and exception fields always visible, and "Finalise shortlist" fires an irreversible action with no summary step.
11. **Feedback is generic.** Every save toasts "Saved". Loading is a bare "Loading your workspace…" paragraph.
12. **Login is a bare card.** TOTP enrolment (QR) and verification already work (`app/login/page.tsx`), but they are unstyled and have no brand.
13. **Role is invisible.** `create`, `rubric`, `publish`, `next` and `dispose` are administrator-only on the server (`lib/store.ts:121-125`), but the client does not know the role, so reviewers would see buttons that return 403.

## 2. Design direction

**Register:** product. Design serves the task; delight is saved for moments (processing, finalisation), not pages.

**Anchor references:** Linear (restraint, "structure felt not seen", LCH-generated theme), Vercel Geist (role-based 10-step colour scale, tonal depth over shadows, weights 400/500/600 only), Stripe Dashboard (data clarity, perceptual colour), Metaview (rubric lines pre-filled with verbatim, linked evidence), Raycast (one bottom action bar with inline shortcuts).

**Colour strategy:** Restrained everywhere (tinted neutrals plus one teal accent under 10% of surface). The results page earns a small data palette for the charts only.

**Rejected:** the UI UX Pro Max generator suggested Fira Code headings and a slate/blue palette; monospace headings read as a developer tool and blue breaks the spec identity. Also rejected: glass cards, gradient text, hero-metric tiles, identical card grids, side-stripe accent borders.

### 2.1 Colour tokens (OKLCH, contrast checked)

Neutrals are tinted toward the navy hue (h 210 to 225, chroma 0.002 to 0.02). Contrast ratios computed on 2 Oct 2026.

| Token                        | Light                  | Hex                        | Dark                   | Hex                      |
| ---------------------------- | ---------------------- | -------------------------- | ---------------------- | ------------------------ |
| `--sidebar`                  | oklch(0.22 0.035 225)  | #051e27                    | same                   | #051e27                  |
| `--bg`                       | oklch(0.985 0.004 210) | #f7fbfc                    | oklch(0.17 0.014 225)  | #091114                  |
| `--surface`                  | oklch(0.998 0.002 210) | #fdffff                    | oklch(0.205 0.016 225) | #0f191d                  |
| `--surface-2` (hover, wells) | oklch(0.965 0.006 210) | #eff5f6                    | oklch(0.24 0.016 225)  | #172125                  |
| `--border`                   | oklch(0.91 0.008 215)  | #dce3e5                    | oklch(0.30 0.016 225)  | #253034                  |
| `--text`                     | oklch(0.24 0.025 225)  | #122228 (15.7:1)           | oklch(0.94 0.008 210)  | #e5edee (16.0:1)         |
| `--text-2`                   | oklch(0.45 0.02 220)   | #49585d (7.1:1)            | oklch(0.72 0.012 215)  | #9da7a9 (7.3:1)          |
| `--text-3`                   | oklch(0.53 0.015 220)  | #636e72 (5.0:1)            | oklch(0.62 0.012 215)  | #7e888b                  |
| `--accent`                   | oklch(0.50 0.095 178)  | #007463 (white text 5.7:1) | oklch(0.72 0.10 178)   | #54b9a5 (ink text 7.3:1) |
| `--accent-hover`             | oklch(0.45 0.09 178)   | #006555                    |                        |                          |
| `--accent-subtle`            | oklch(0.955 0.025 178) | #dff6f0                    |                        |                          |
| `--danger`                   | oklch(0.53 0.17 25)    | #ba3535 (5.7:1)            |                        |                          |

**Evidence scale** (ordinal, one hue light to dark plus a reserved status colour):

| Category                 | Light                  | Dark            | Secondary encoding         |
| ------------------------ | ---------------------- | --------------- | -------------------------- |
| Full evidence            | #006e5e                | #4db39e         | filled circle icon + label |
| Partial evidence         | #6bbdab                | #2f7063         | half circle icon + label   |
| Not evidenced in this CV | #dadfe0 + 45° hatch    | #2d3437 + hatch | empty circle icon + label  |
| Needs your judgement     | #f2af48 (status amber) | #e8aa4e         | alert icon + label         |

The dataviz validator passes CVD separation (worst adjacent ΔE 13.3 protan light, 17.9 dark) and the normal-vision floor. It warns that the light tints sit under 3:1 against the surface, so every cell carries an icon and text, charts print values directly and a table view exists. Its lightness-band and chroma failures are categorical-palette rules and do not apply to an ordinal scale.

### 2.2 Typography

- **Geist Sans** for all UI and **Geist Mono** for scores, candidate labels and IDs, loaded through `next/font` (self-hosted, so the restrictive production CSP never needs a font origin).
- Scale at roughly 1.2: 12 / 13 / 14 / 16 / 19 / 23 / 28 px, set in rem so browser text size and 200% zoom scale the layout.
- Weights 400 body, 500 labels and buttons, 600 headings. Nothing heavier.
- Tracking: −0.02em at 23px and above, 0 for body, +0.01em on 12px labels.
- CV source text: 15px / 1.6, capped at 68ch. That is where people read longest.
- `font-variant-numeric: tabular-nums` on every score, count and point total.

### 2.3 Space, shape, depth

- 4px grid. Section rhythm 16 / 24 / 40 / 64 so related things cluster and sections breathe.
- Radii 6 (inputs, chips), 8 (buttons, rows), 12 (panels, sheets).
- Depth from tonal steps and 1px borders. Shadows only on floating layers (popover, sheet, toast), three levels, never on resting panels. No nested cards.
- Icons: Lucide at 1.5 stroke, 16px inline and 20px navigation, one style per level.

### 2.4 Logo

**Concept "the shortened list":** three horizontal rounded bars, left-aligned, decreasing in length (100%, 72%, 44%), the top bar in teal and the others in current text colour. It reads as a list being narrowed and quietly echoes "up to three". The wordmark is "Shortlist" in Geist Sans 600 at −0.02em, with the mark's bar height matched to the x-height.

Deliverables: `components/brand/logo.tsx` (mark, wordmark and lockup, all `currentColor` with an accent slot), `app/icon.svg` favicon tested at 16px, `app/apple-icon.png`, and a monochrome variant for the CSV export header and print. The mark is the seed for the processing animation and the finalisation moment, so the brand and motion share one idea.

## 3. Motion system

Motion conveys state only. Tokens live in CSS custom properties and one `lib/motion.ts`:

| Token           | Value                                           | Use                                          |
| --------------- | ----------------------------------------------- | -------------------------------------------- |
| `--dur-press`   | 100ms                                           | button press scale 0.97                      |
| `--dur-fast`    | 150ms                                           | hover, tooltip (125ms), chip state           |
| `--dur-base`    | 200ms                                           | popover, crossfade, step change              |
| `--dur-slow`    | 300ms                                           | sheet, panel, CV-to-CV transition            |
| `--ease-out`    | cubic-bezier(0.23, 1, 0.32, 1)                  | default enter and exit                       |
| `--ease-in-out` | cubic-bezier(0.77, 0, 0.175, 1)                 | on-screen movement                           |
| `--ease-drawer` | cubic-bezier(0.32, 0.72, 0, 1)                  | sheets                                       |
| spring          | `{ type: "spring", bounce: 0, duration: 0.35 }` | layout moves: reorder, selection, row settle |

Rules:

- CSS transitions for hover and press. The `motion` package (`motion/react`, `LazyMotion` + `m`) only for presence, layout and reorder. Bounce stays 0 because nothing in this app is flicked.
- Only `transform` and `opacity`. Popovers scale from their trigger using Radix's transform-origin variable. Exits run at about 70% of enter time.
- Direction carries meaning: moving forward through steps or CVs enters from the right; going back enters from the left.
- Never animate keyboard-repeated actions (J/K through criteria, 1 to 4 category keys). Those change instantly.
- `<MotionConfig reducedMotion="user">` plus a `prefers-reduced-motion` block: movement becomes a 150ms crossfade, the processing animation becomes a static stage list, chart bars render at final size.
- Motion sets inline styles through the CSSOM, which a nonce-based `style-src` does not block. Verify under the production CSP anyway.
- Verify animated flows in real Chrome and Playwright, not the desktop preview pane, which runs no animation frames (shared lesson DESIGN-04).

## 4. Information architecture and flow

### 4.1 Routes (deep links, back button, refresh-safe)

```
/login
/vacancies                                         list + progress
/vacancies/new                                     title, team, description
/vacancies/[vacancy]/[batch]/criteria
/vacancies/[vacancy]/[batch]/cvs
/vacancies/[vacancy]/[batch]/review/[candidate]
/vacancies/[vacancy]/[batch]/shortlist
/admin/{members,retention,processing,data}
```

The unsaved-draft guard moves from per-button toasts to one router-level guard. With autosave it should rarely fire.

### 4.2 Shell

- **Sidebar (navy):** logo lockup; "Vacancies"; the vacancy list with a small progress ring per vacancy; footer with "How it works", Administration (admin role only) and the account menu. Collapses to an icon rail under 1024px and to a top bar with a sheet under 768px.
- **Vacancy header:** title, team, batch switcher (Radix Select showing "Week of 5 Oct · Finalised"), names-hidden status chip.
- **Stepper:** the spec's four steps with state (done, current, locked) and a live sublabel ("94 / 100 points", "6 CVs · 1 needs attention", "4 of 6 reviewed", "Up to 3"). Locked steps explain why on focus and hover, never hover-only.
- **Role awareness:** expose the member's role to the client. Administrator-only actions (create vacancy, save or publish criteria, record disposition, start next batch) are hidden from reviewers, or disabled with "Administrator action" where seeing them helps orientation.
- **Synthetic-data banner** shrinks to a slim, persistent chip in the header. It remains always visible.

### 4.3 Vacancies home

A list rather than cards: role, team, current batch, a four-segment progress strip, "4 of 6 reviewed" in tabular figures, and a specific next action as the row's button ("Review 2 CVs", "Publish criteria", "Choose shortlist"). The empty state teaches the four-step flow in one line and offers "Create vacancy".

### 4.4 New vacancy

A focused page, not a modal: three fields only, as the spec requires. "Create and set criteria" lands directly on Criteria with AI drafting offered if available.

### 4.5 Criteria

- A **sticky allocation bar** across the top. Each criterion is a segment proportional to its points, with essentials marked. Text reads "94 of 100 points · 6 to allocate" and turns to "100 of 100 · ready to publish". It animates width through `scaleX` on segments, not layout.
- **Sections as groups** (spec), each criterion a compact row: requirement title, points stepper (−/+ plus typed input), Essential switch, and an overflow menu (Move up, Move down, Duplicate, Remove). Remove shows an Undo toast.
- Drag to reorder with the motion `Reorder` group; the menu provides the keyboard path.
- Evidence definitions expand inline under the row (spec: expandable rows).
- **No server autosave.** The version check is workspace-wide (`lib/store.ts:116`; every action bumps it), so background saves would collide with every other user, and the server rejects incomplete rows (`lib/workflow.ts:12-22`). Keep edits as a local draft with an unsaved-changes indicator, keep the explicit "Save draft" (enabled only when every row is complete, with the reason shown otherwise), and keep the version check on save and publish. A 409 shows an inline banner with "Load latest", never an overwrite.
- "Draft with AI" fills rows progressively with a skeleton-to-content morph and marks drafted rows "AI draft · edit freely" until touched.
- **Publish** opens a confirmation sheet summarising criteria count, essentials and the rule "criteria lock for this batch".

### 4.6 CV intake and the processing experience

- One **dropzone** for multiple files (drag or browse) with limits stated up front: PDF or DOCX, up to 30 files, 5 MB and 10 pages each. Rejections appear inline per file with the reason.
- One unified file list (merging today's two panels). Each row has the anonymous label, the file name, a stage indicator and the next action.
- Issues are pinned at the top: "1 needs a readable copy" with inline actions (Upload text copy, Transcribe passages, Retry, Record disposition). The disposition form opens inline in the row, not in a modal.
- A **batch-level determinate bar** ("4 of 6 ready"), because the total is known.
- "Start review" stays disabled with the reason ("2 documents still processing") until everything is ready or disposed.

**The waiting animation, "reading the page":**

1. Each processing file shows a small document glyph: a rounded page with five skeleton text lines.
2. **Queued:** the page sits still at 60% opacity, labelled "Waiting to start".
3. **Extracting text** (sandbox parse): a thin teal scan line glides down the page on a 1.6s ease-in-out loop and lines firm up as it passes. Label: "Extracting text safely".
4. **Reading evidence** (AI passes): two or three lines highlight in teal in turn, echoing evidence being found. Label: "Finding evidence for 7 criteria".
5. **Ready:** the five lines contract into the three-bar logo mark (a 350ms spring), then the glyph swaps to a check and the row settles. Label: "Ready to review".
6. **Needs attention:** the page stops and turns neutral with an amber alert icon and plain reason. Never red-flash. A processing failure is never zero points, and the copy says so.

Honesty rules: no fake percentage per file. Use a typical range ("usually under a minute per CV") only once real timings exist. Announce completions through a polite `aria-live` region, throttled to one message every few seconds. Under reduced motion it becomes a static stage list (Queued → Extracting → Reading → Ready) with the current stage in bold.

Backend touchpoints: `documents.status` is `reserved / queued / complete / readable_copy / attention / deleted`, while `processing` is an application state in the workspace JSON. `/api/documents` returns only id, application key, status, safe error code, attempts, reservation time and deletion state, so nothing today separates "Extracting text" from "Reading evidence". Phase 2 either ships three honest stages (Queued → Processing → Ready, with steps 3 and 4 merged into one "Extracting text and finding evidence" state) or adds a `stage` column written by the consumer as listed backend scope. Handle `reserved` ("Uploading") and `deleted` rows explicitly. Polling becomes adaptive: about 2s while anything is in flight, stopped when idle.

### 4.7 Review (the core screen)

Three zones on desktop at 1280px and above:

1. **Queue rail (left, collapsible):** Candidate 01 to N with status icons (to review, draft, needs check, confirmed) and "4 of 6 reviewed". This replaces blind Previous/Next.
2. **Criteria (centre):** one row per criterion, in two visual classes.
   - **Agreed, ordinary criteria:** compact row with category chip, AI note (secondary text colour, "AI note" label) and the first quotation. No individual checkbox (spec review-burden rule).
   - **Needs individual check** (essentials, UNCLEAR, pass disagreement, manual change): expanded by default with a "Check required" chip, the reason field and the individual check, so the work is visibly where it matters.
   - Category becomes a **segmented control** with four icon-and-label options instead of a select. Keys 1 to 4 set it.
3. **Source (right):** the CV text at reading size. Selecting a criterion highlights its passages and scrolls the first into view; clicking a quote focuses its passage. Choosing evidence happens directly in the source: with a criterion active, clicking a passage toggles it as evidence. This replaces the checkbox list of block IDs.

A **sticky bottom action bar** (Raycast pattern) holds the attestation, an unsaved-changes indicator, "Confirm and next" with its disabled reason ("Resolve 1 'Needs your judgement'"), and shortcut hints.

**No review autosave.** Any server review save clears the CV's confirmation and the batch's provisional selection (`lib/workflow.ts:543-546`) and rejects a changed criterion until it has a reason and check (`workflow.ts:521-534`). Keep edits client-side, keyed by run id and document version, with one server write on "Confirm and next" as the spec intends; the explicit "Save draft" stays for long sessions. Before editing an already confirmed CV, say inline: "Editing clears this confirmation and the provisional shortlist."

Shortcuts: `J/K` criterion, `1–4` category, `E` edit reason, `[` and `]` previous or next CV, `⌘↵` confirm and next, `?` shortcut sheet. Every one also has a visible control. Single-key shortcuts are ignored while focus is in a text field, and `[`/`]` are blocked with an explanation while the current CV has unsaved edits (matching today's disabled Previous).

CV-to-CV transition: 300ms direction-aware slide plus crossfade on the centre and source zones only; the rail and action bar stay put.

Under 1024px the source becomes a tab ("Criteria | Source") with a "View passage" link that switches tabs and highlights. That meets the spec's stacking rule without endless scrolling.

### 4.8 Shortlist and results (with visuals)

Shown only once ranking exists. Before that, an empty state explains "Ranking appears after all 6 CVs are reviewed. 2 remaining" with a link to the next one.

**Summary sentence**, not hero metrics: "6 CVs reviewed. Confirmed scores range 48 to 86. Positions 3 and 4 tie at 72."

**Visual 1: Score composition (primary).** One horizontal bar per candidate on a shared 0 to 100 axis, sorted by confirmed score. Segments show points from Full evidence (dark teal) and Partial evidence (light teal) over a neutral track, with a 2px surface gap between segments. The score is printed at the bar end in Geist Mono. A dashed **cut line** after position 3 marks the boundary; when a tie straddles it, both rows get a "Tie at 72" marker and the tie-reason field appears beside them. Missing essentials show as a text chip on the row ("Essential not fully evidenced: Customer escalation"), never as a red bar. Rows are the selection control: click or Space to select, maximum three, with a live "2 of 3 selected" counter. Selected rows get an accent outline and a 350ms spring settle into a "Shortlist" tray above.

**Visual 2: Evidence matrix.** Rows are candidates ordered by candidate label, not by score, so a mostly hatched row is not read as a ranking of people, columns are criteria with points in the header and a ◆ marking essentials. Each cell holds the category icon on its tint and is never colour-only. Clicking a cell opens a popover with the AI note and quotation. Column header tooltips show the definitions. This answers "why is this candidate here" at a glance. The cell detail uses the exact wording "Not evidenced in this CV".

**Scope for sign-off:** phase 4 ships Visual 1 with its table view. Visuals 2 to 4 wait for the customer's decision on the spec deviation, because each one widens the surface the customer must approve.

**Visual 3: Evidence coverage by criterion.** Small bars showing how many CVs had full evidence for each criterion ("Full evidence in 2 of 6 CVs"). It helps the recruiter calibrate requirements for the next batch. Wording describes evidence in CVs, not ability.

**Visual 4 (finalists, optional): Side by side.** For the two or three selected candidates, aligned per-criterion bars in small multiples. No radar chart: radar scores a B for accessibility and distorts comparison on more than eight axes.

Chart rules:

- Hand-built SVG React components. The data is at most 30 × 12, a chart library adds weight and CSP surface, and custom marks match the tokens exactly.
- Every chart has a "Table" toggle (the spec-compliant fallback), an accessible summary sentence, keyboard-focusable marks with tooltips on focus, legends where there are two or more series, and direct labels.
- Names follow the global reveal toggle. Charts show "Candidate 03" until revealed.
- Bars grow once on first reveal (400ms, 30ms stagger), and values are readable from frame one.

**Selection and finalisation flow:**

- "Select highest scores" animates selection to the top three and stops at a boundary tie, with an inline explanation (spec).
- The tie-reason field appears only when a tie straddles the cut. The essential-exception field appears only under a selected candidate with an unmet essential. The selection reason is always visible and required.
- **Finalise** opens a review sheet listing the selected candidates, reasons and exceptions, the frozen-snapshot warning, and a typed or explicit confirmation. Then comes a finalisation moment: the three logo bars draw in, the top one fills teal, and a check resolves (600ms, once, skipped under reduced motion). It is followed by a receipt with the snapshot time, "Export review CSV" and "Start next batch".

### 4.9 Login and MFA

Split layout: a quiet navy panel with the logo lockup and one line of product truth ("Evidence first. You decide."), with the form on the light side. Redesign both existing MFA screens. Enrolment shows the QR code, a copyable manual secret and the first-code check. Verification uses a six-cell one-time-code input (paste-aware, keeping `autocomplete="one-time-code"`). Errors are inline and state the fix.

### 4.10 Administration

Tabs: Members, Retention, Processing, Data. Tables with sticky headers, status chips with icon and text, destructive actions separated and styled as danger with confirmation, and readiness checks as a checklist.

## 5. Component system

Move from 1,397 lines of bespoke CSS to tokens in `@theme` plus shadcn and Radix primitives, so every screen shares one vocabulary.

| Add (Radix-based shadcn)                          | Replaces                                |
| ------------------------------------------------- | --------------------------------------- |
| Select, Switch, ToggleGroup (segmented), Checkbox | native select, raw checkboxes           |
| Tabs, Tooltip, Popover, DropdownMenu, Sheet       | modals-first patterns, text-button rows |
| Progress, Skeleton, ScrollArea, Kbd, Table        | "Loading…" text, bespoke rows           |
| Command (cmdk) for a ⌘K palette (phase 5)         | none                                    |

Component contract: every interactive component defines default, hover, focus-visible, active, disabled (with a reason where it is a primary action), loading and error states.

- **Button:** primary (teal), secondary (neutral outline), ghost, danger. Heights 32 / 36 / 40px, with a 44px minimum hit area on touch. A loading spinner keeps the width. Press scale 0.97.
- **Focus:** a 2px accent ring with 2px offset. Pair every outline reset with `focus-visible:outline-solid` (shared lesson DESIGN-06) and verify with a real Tab press.
- **Status chip:** icon plus label, one component for every state across intake, review, results and admin.
- **Toasts:** specific ("Review saved for Candidate 04", "Criteria published"), `aria-live` polite, never focus-stealing, and Undo where an action is reversible.

## 6. Delivery phases

Each phase runs on its own branch after the backend hardening branch merges. Each ends with an impeccable `critique` and `audit`, the existing Vitest, Playwright and Axe suites green, checks at 390px, 1440px and 200% zoom, reduced-motion and dark-mode passes, then review, commit, PR and CI.

| Phase                 | Scope                                                                                                                                                                                                                                             | Exit check                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 0 Foundations         | Role exposed to the client, per-batch candidate ordinal, `PRODUCT.md` and `DESIGN.md` (impeccable teach and document), spec-deviation record, OKLCH tokens light and dark, Geist via next/font, logo and favicon, motion tokens, primitives in §5 | Token contrast table re-verified in the browser; primitive state gallery reviewed                               |
| 1 Shell and routes    | Routing in §4.1, sidebar, header, stepper, vacancies home, new-vacancy page, login with MFA enrolment and verification, role-aware actions, candidate labels                                                                                      | Deep link, refresh and back restore place; one `main` landmark; skip link                                       |
| 2 Criteria and intake | Allocation bar, grouped rows, local drafts with conflict banner, optional `stage` column, dropzone, unified list, processing animation, adaptive polling                                                                                          | Live upload of a fictional PDF and DOCX shows every stage; reduced-motion fallback verified                     |
| 3 Review              | Three-zone layout, segmented categories, check-required class, source-linked evidence, action bar, shortcuts, mobile tabs                                                                                                                         | A full fictional batch reviewed by keyboard only; timing recorded against the spec's pilot measure              |
| 4 Results             | Visual 1 and table view (Visuals 2 to 4 after customer sign-off), selection tray, tie and exception progressive disclosure, finalise sheet and moment                                                                                             | Tie fixture shows the boundary correctly; charts stay hidden until all reviews are done; Axe passes with charts |
| 5 Polish              | Admin tabs, dark-mode tuning, ⌘K palette, empty and error states everywhere, performance pass                                                                                                                                                     | Lighthouse accessibility 100; CLS under 0.1; INP under 200ms; impeccable `polish`                               |

New dependencies, pinned exactly like the rest of `package.json`: `motion`, `geist`, Radix select, switch, toggle-group, tabs, tooltip, popover, dropdown-menu, progress and scroll-area, plus `cmdk` in phase 5.

## 7. Risks

- **Spec deviation:** charts need customer sign-off. Until then, ship them behind the table toggle so the default could fall back to the table.
- **Test coupling:** the six Playwright cases and `tests/live-local.ts` select by visible text and labels. Keep accessible names stable where possible and update tests in the same PR when wording changes.
- **Refactor size:** `workspace.tsx` splits into route segments and feature folders (`components/criteria`, `intake`, `review`, `results`). Do it in phase 1 without visual change first, so later diffs stay reviewable.
- **Concurrency:** the version check is workspace-wide, so the UI must not add background writes. Saves stay explicit, and a 409 is surfaced with "Load latest" instead of being retried silently.
- **Motion budget:** if any animation makes a reviewer wait, cut it. The review loop must feel instant.

## 8. How we will know it worked

Engineering and QA evidence is not a business outcome; keep the two separate when reporting.

- Unaided task completion: an independent recruiter finishes a fictional batch without help (stage 1 exit gate).
- Time per CV in review, measured against the current UI with the same fixtures.
- Zero Axe violations, keyboard-only completion of all four steps, correct behaviour at 390px and 200% zoom.
- Qualitative check against the product slop test: would a Linear or Stripe user pause at any component?
