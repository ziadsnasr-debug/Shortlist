# SHORTLIST — UI and UX redesign plan

2 October 2026 · Proposed direction · No application changes made

Based on Technical_Specification (2).docx, version 1.2. The workspace contains the specification only; its companion HTML and current app were unavailable. This is a product-specific design proposal, not a visual audit of the existing implementation. Current user request supersedes the specification's navy/teal palette and prohibition on charts. Other workflow requirements remain intact.

## 1. Direction

Build a premium, calm recruiter workspace: warm ivory canvas, charcoal navigation, cobalt actions, crisp typography, strong alignment and purposeful motion. The central experience is reviewing evidence confidently, then comparing completed reviews.

Aim for substantial improvement through layout, hierarchy, state handling and interaction quality. Use space generously around decisions; keep document evidence information-dense and readable. Avoid decorative analytics, oversized score gauges, glass panels, ambient animation and visual claims of AI certainty.

## 2. Reference board

Public sources consulted on 2 October 2026. These are references for specific patterns, not templates to copy wholesale or claims of awards.

| Reference | Pattern to adapt | SHORTLIST application |
| --- | --- | --- |
| [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) | Consistent sidebar/header alignment, quiet navigation and clear panel hierarchy | One stable shell across all four steps |
| [Attio](https://attio.com/) and [Attio screen collection](https://nicelydone.club/apps/attio) | Structured records and contextual detail views | Vacancy list, review metadata and candidate evidence panels |
| [Mobbin](https://mobbin.com/) | Real product flows as a research library | Check upload, empty, error and drawer patterns during screen design; no paid/private flows inspected |
| [Carbon data visualisation](https://www.carbondesignsystem.com/building-blocks/data-visualization/overview) | Clear, accessible quantitative graphics | Labelled comparison bars and evidence matrices |
| [Motion reduced-motion guidance](https://motion.dev/docs/react-use-reduced-motion) | Adapt movement to user preferences | Shared motion policy and static fallbacks |

## 3. Visual system

| Token | Proposed value | Use |
| --- | --- | --- |
| Canvas | `#F6F5F2` | Warm background |
| Surface | `#FFFFFF` | Documents, forms, panels |
| Navigation / main text | `#20242C` | Charcoal sidebar and headings |
| Secondary text | `#626875` | Supporting copy |
| Primary | `#3454D1` | Main actions, active step, focus |
| Primary tint | `#EEF1FF` | Selected rows and contextual emphasis |
| Decorative divider | `#E1E3E8` | Section separation; not sole input boundary |
| Control boundary | `#818793` | Recognisable form controls |
| Complete | `#187451` | Reviewed/saved state, with icon and text |
| Attention | `#935B0D` | Unresolved evidence, with explicit label |
| Error | `#B52F40` | Processing or validation error |

Verify actual foreground/background combinations before shipping. Semantic status colours never indicate a person's worth or probability of success.

- Typography: one self-hosted variable sans, proposed Geist Sans; system fallback. 28–32px page headings, 18–20px section headings, 16px evidence/body, 13–14px labels; tabular numerals for points and counts.
- Spacing: 4px base; 8/12px inside controls, 16/24px between groups, 32px page gutters on desktop.
- Shape: 8px controls, 12px panels, restrained 1px borders; shadows for overlays only.
- Icons: one consistent outline family, proposed Lucide. Text accompanies consequential actions.
- Light theme first. Structure tokens for future dark mode; a full second theme is optional follow-up scope.

## 4. Navigation and screen plan

Global navigation: Vacancies, Finalised batches, Settings. Keep workspace/team control at the top and help/account below. Desktop sidebar approximately 224px; collapse into a labelled menu on narrow screens.

Inside a vacancy: title, batch date, save state and a persistent four-step bar: **Criteria → Add CVs → Review → Shortlist**. Each screen has one obvious primary action and a nearby explanation when it cannot proceed. Previous steps respect intake and rubric locks.

### A. Vacancy home

Use a clean role list with title, team, batch stage, reviewed count and Continue action. Above it: a compact workload strip for active vacancies, applications awaiting review and items needing attention. These are actual operational counts, not invented business KPIs.

First use: focused empty state with “Create vacancy”, brief three-line explanation and clearly labelled fictional demo option. Returning users resume their last valid working position.

### B. Criteria builder

Main column groups six to eight preferred criteria by section; secondary panel shows section weights and the running total out of 100. Expand a criterion to edit evidence definitions, integer points and essential status. Keep numeric fields authoritative; optional reordering includes keyboard-accessible move controls.

Job-description suggestions enter as an editable draft. Display what changed before human publication. Show “12 points left to allocate” or “8 points over” beside the publish action. Publication requires valid definitions and a total of 100.

### C. CV intake

Large upload target plus an equally visible file-picker button. State PDF/DOCX limits before upload. Each row shows filename, actual processing stage, concise issue and next action. Use distinct upload progress and server-processing status; no fabricated percentage while processing.

States include uploading, queued, processing, ready, needs readable copy and needs attention. Support retry, readable replacement or explicit permitted disposition with reason. Account for every uploaded item. No scores on this screen.

“Close intake and start review” clearly communicates the transition. Explain unresolved items and route to their recovery action; do not let a polished completion animation conceal failed files.

### D. Evidence review — flagship screen

Desktop: wide assessment column and source-context panel side by side, with a compact candidate navigator. Show “Application 07” while identities are hidden. Header includes review progress, current review state and unresolved count.

Each criterion displays plain-language category, points rule, a short labelled AI note and actual source passage. Clicking the source reference focuses the corresponding safe text block and briefly highlights it. PDF references may include verified page numbers; DOCX references use paragraph identifiers.

Expand details progressively without concealing essential checks or unresolved judgements. Distinguish source text, AI suggestion and recruiter override visually. Ordinary agreed criteria need one application-level confirmation; essentials, disagreements, unclear results and manual edits retain individual checks and reasons where required.

Persistent footer: “2 items need your judgement” with a jump action, or “Confirm and next”. Save before advancing; on failure keep edits and position. Draft save state reads Saving, Saved or Save failed. Version conflicts offer explicit reconciliation, never silent overwrite.

### E. Shortlist and comparison

Reveal ranking only once every active application has a resolved review and intake is closed. Names remain hidden until explicit reveal. Keep essential requirements separate from total points.

Show a ranked list and a comparison workspace for up to three selected applications. A sticky selection tray says “2 of 3 selected”. Let users compare criteria, inspect supporting evidence, document an essential exception and resolve boundary ties explicitly.

Finalisation screen summarises chosen IDs, essential exceptions and the written selection reason. Zero selections is valid. Explain that finalisation freezes the snapshot. Successful completion shows a restrained confirmation and export action. No reopen control.

### F. Supporting surfaces

Include consistent invitation, access-denied, session-expired, empty-batch, loading, concurrent-edit, deletion and export states. Keep operational settings separate from daily review. Finalised batches are read-only; exports retain the scoring and source context needed to understand the decision.

## 5. Graphs that earn their space

| Graphic | Where | Meaning and behaviour |
| --- | --- | --- |
| Segmented progress strip | Vacancy/batch header | Count by processing/review state; clicking a segment filters the relevant list |
| Weight-allocation bars | Criteria | Published maximum points by section; labelled total remains 100 |
| Horizontal score bars | Shortlist, after reviews complete | Confirmed points on a fixed 0–100 scale, exact values beside bars |
| Evidence matrix | Comparison | Criteria × selected applications; category words/icons and credited/max points; click opens evidence |
| Grouped section bars | Comparison | Same section scale across applications; reveal which sections explain score differences |

Provide a table alternative and keyboard access for interactive charts. Label sample sizes. Do not mix different rubric versions in a comparison. Unknown results never become zero; unfinished batches show progress, not ranking. No radar charts, inferred personality graphs, model confidence percentages or hiring-success predictions. Historical trends need enough comparable real batches and are deferred.

## 6. Motion specification

| Interaction | Proposed motion | Timing |
| --- | --- | --- |
| Pointer press | Subtle scale to 0.98; immediate feedback | 100ms |
| Pointer step/tab change | Active indicator moves; content subtly fades | 160–180ms |
| Popover | Origin-aware fade and scale from 0.98 | 140–180ms |
| Evidence drawer | Short slide with fade, interruptible | 220ms |
| Save/processing result | Stable label replaced with icon/text confirmation | 120–160ms |
| Comparison graphic entry | Bars reveal once; values immediately readable | 240ms |
| First vacancy entrance | At most three lightly staggered groups | Total under 300ms |

Default easing: `cubic-bezier(0.23, 1, 0.32, 1)`. Prefer opacity and transforms. Repeated candidate navigation stays immediate; skip decorative motion for keyboard actions. Do not animate score values through false intermediate numbers. Live list updates preserve row position and focus.

Reduced motion removes spatial movement, staggering and bar reveals. No interaction or save depends on animation completion. Avoid looping backgrounds, confetti and pulsing scores. Use CSS for simple feedback and add Motion only where coordination meaningfully helps.

## 7. Responsive and accessible behaviour

- Desktop: evidence and source visible together; sensible minimum widths and a readable document measure.
- Tablet: collapsible navigation and a source drawer while retaining assessment position.
- Phone: single-column review with labelled Assessment/Source views; return to the same criterion and scroll position. Comparison becomes labelled stacked sections without losing cross-candidate context.
- Validate 390, 768, 1024 and 1440px layouts, 320px reflow and 200% zoom. Sticky actions must not cover fields, source text or mobile keyboard interactions.
- Keyboard-complete flow, visible focus, skip link, semantic table headings, labelled inputs, dialog Escape/focus restoration and meaningful status announcements.
- Target at least 4.5:1 normal text contrast and 3:1 meaningful control/graphic contrast. Use 44px primary touch targets as a product standard.
- Test errors, expanded content and long text, not only happy-path screenshots. Screen-reader and real-browser motion checks supplement automated accessibility tests.

## 8. Delivery order and acceptance

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Baseline and direction | Locate companion UI; map current states; reference board, palette and key-screen designs | Existing functionality accounted for; review and shortlist designs show actual representative content |
| 2. Foundation | Tokens, typography, navigation, buttons, fields, status badges, dialogs and responsive shell | Consistent component states and contrast; desktop/mobile shell verified |
| 3. Core workflow | Criteria, intake, evidence review and recovery states | Synthetic batch can be fully reviewed with errors and disagreements resolved |
| 4. Comparison | Charts, evidence matrix, tie handling, selection and finalised view | Rankings gated correctly; denominator fixed; zero-to-three selection and frozen snapshot preserved |
| 5. Polish and validation | Motion, focus, empty/loading/error states, usability pass | Reduced motion, keyboard, zoom and real browser checks pass; no blocked workflow due to animation |

If the proposed Next.js/TypeScript app is used, retain its shadcn/ui and Tailwind foundation. Plan reusable AppShell, Stepper, CriterionEditor, FileStatusRow, EvidenceCard, SourcePanel, ScoreBar, ComparisonMatrix and SelectionTray components. Simple labelled bars can use semantic HTML/SVG; choose a chart library only after inspecting actual app dependencies. Keep scoring and workflow permissions server-authoritative.

Use fictional fixtures covering a normal batch, unreadable document, ambiguous evidence, unmet essential, boundary tie, concurrent edit and save failure. Add focused regression coverage for those consequential paths; visual tests cover representative layouts and motion preferences.

Run a small usability session with three to five representative recruiters. Each should identify the next action unaided, locate cited evidence, resolve an unclear item and complete a shortlist. Record task completion, errors, lost edits and source-finding time. Establish a baseline before claiming a speed improvement; faster clicking alone is not better review quality.

First implementation priority: the evidence-review screen plus shared shell. It establishes the visual direction and improves the product's highest-value activity. Then extend the system across the other steps.

Open dependency: current app URL/path or companion HTML is needed for an accurate before/after audit and implementation estimate. It does not block this design direction.
