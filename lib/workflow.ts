import { z } from "zod";
import { minimise } from "./minimisation";
import type {
  Category as RuleCategory,
  Criterion as RuleCriterion,
} from "./rules";
import {
  type Application,
  type Batch,
  type Vacancy,
  type Workspace,
  allReviewed,
  boundaryTie,
  ranking,
  requireRule,
  reviewBlockers,
  score,
  unmetEssentials,
  validateEvidence,
} from "./rules";
export * from "./rules";

export const Category = z.enum(["FULL", "PARTIAL", "NOT_EVIDENCED", "UNCLEAR"]);
export type Category = z.infer<typeof Category>;
export const Criterion = z
  .object({
    id: z.string().min(1).max(80),
    section: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(200),
    points: z.number().int().positive().max(100),
    essential: z.boolean(),
    full: z.string().trim().min(1).max(1000),
    partial: z.string().trim().min(1).max(1000),
    equivalents: z.string().trim().max(500).optional(),
  })
  .strict();
export type Criterion = z.infer<typeof Criterion>;
export function validateRubric(rubric: Criterion[]) {
  requireRule(
    rubric.length > 0 && rubric.length <= 12,
    "Use between 1 and 12 criteria.",
  );
  rubric.forEach((c) => Criterion.parse(c));
  requireRule(
    new Set(rubric.map((c) => c.id)).size === rubric.length,
    "Criterion IDs must be unique.",
  );
  requireRule(
    rubric.reduce((s, c) => s + c.points, 0) === 100,
    "Criteria must total exactly 100 points.",
  );
}
const id = z.string().min(1).max(100);
const base = { vacancyId: id, batchId: id };
export const Action = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      title: z.string().trim().min(1).max(100),
      team: z.string().trim().max(80),
      description: z.string().trim().min(1).max(6000),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("rubric"),
      rubric: z.array(Criterion).max(12),
    })
    .strict(),
  z.object({ ...base, type: z.literal("publish") }).strict(),
  z.object({ ...base, type: z.literal("samples") }).strict(),
  z
    .object({
      ...base,
      type: z.literal("dispose"),
      applicationId: id,
      disposition: z.enum(["duplicate", "withdrawal", "wrong_vacancy"]),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("manual_source"),
      applicationId: id,
      name: z.string().trim().max(100),
      passages: z
        .array(
          z
            .object({
              locator: z.string().trim().min(1).max(100),
              text: z.string().trim().min(1).max(10000),
            })
            .strict(),
        )
        .min(1)
        .max(30),
      reason: z.string().trim().min(1).max(1000),
      attest: z.literal(true),
    })
    .strict(),
  z.object({ ...base, type: z.literal("close") }).strict(),
  z
    .object({
      ...base,
      type: z.literal("review"),
      applicationId: id,
      runId: id,
      documentVersion: z.number().int(),
      decisions: z.record(
        z.string(),
        z
          .object({
            category: Category,
            evidence: z.array(id).max(30),
            checked: z.boolean(),
            reason: z.string().max(1000),
          })
          .strict(),
      ),
      sourceChecked: z.boolean(),
      confirm: z.boolean(),
      attest: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("selection"),
      selected: z.array(id).max(3),
      reason: z.string().max(2000),
      tieReason: z.string().max(1000),
      exceptions: z.record(z.string(), z.string().max(1000)),
    })
    .strict(),
  z.object({ ...base, type: z.literal("finalise") }).strict(),
  z
    .object({
      ...base,
      type: z.literal("next"),
      label: z.string().trim().min(1).max(100),
    })
    .strict(),
]);
export type Action = z.infer<typeof Action>;
export function applyAction(
  state: Workspace,
  action: Action,
  actor: string,
  makeId: () => string,
  samples: (rubric: Criterion[], version: number) => Application[],
) {
  const next = structuredClone(state);
  if (action.type === "create") {
    next.vacancies.push({
      id: makeId(),
      title: action.title,
      team: action.team,
      description: action.description,
      batches: [
        {
          id: makeId(),
          label: "First batch",
          rubric: [],
          rubricVersion: 1,
          published: false,
          closed: false,
          applications: [],
          selected: [],
          reason: "",
          tieReason: "",
          exceptions: {},
        },
      ],
    });
  } else {
    const vacancy = next.vacancies.find((v) => v.id === action.vacancyId);
    requireRule(vacancy, "Vacancy not found.");
    const batch = vacancy.batches.find((b) => b.id === action.batchId);
    requireRule(batch, "Batch not found.");
    requireRule(
      action.type === "next" || !batch.snapshot,
      "Finalised batches are immutable. Start a new batch.",
    );
    switch (action.type) {
      case "rubric":
        requireRule(
          !batch.published && !batch.applications.length,
          "Published criteria are frozen.",
        );
        batch.rubric = action.rubric;
        break;
      case "publish":
        requireRule(!batch.published, "Criteria already published.");
        validateRubric(batch.rubric);
        batch.published = true;
        break;
      case "samples":
        requireRule(
          batch.published && !batch.closed,
          "Publish criteria and keep intake open.",
        );
        requireRule(
          !batch.applications.length,
          "Sample documents already added.",
        );
        batch.applications = samples(batch.rubric, batch.rubricVersion).map(
          (a) => (batch.id === "first-batch" ? a : { ...a, id: makeId() }),
        );
        break;
      case "dispose": {
        requireRule(
          !batch.closed,
          "Dispositions must be recorded before intake closes.",
        );
        const app = batch.applications.find(
          (a) => a.id === action.applicationId,
        );
        requireRule(app, "Application not found.");
        app.state = "disposed";
        app.disposition = action.disposition;
        app.dispositionReason = action.reason;
        app.confirmed = false;
        break;
      }
      case "manual_source": {
        requireRule(
          !batch.closed,
          "Manual passages must be checked before intake closes.",
        );
        const app = batch.applications.find(
          (a) => a.id === action.applicationId,
        );
        requireRule(
          app &&
            ["readable_copy", "attention", "processing"].includes(app.state),
          "Manual handling unavailable.",
        );
        requireRule(
          action.passages.reduce((n, p) => n + p.text.length, 0) <= 100000,
          "Manual text limit exceeded.",
        );
        app.documentVersion++;
        app.runId = makeId();
        app.name = action.name;
        app.state = "ready";
        app.confirmed = false;
        app.sourceChecked = false;
        app.blocks = action.passages.map((p, i) => ({
          id: `M_B${i + 1}`,
          locator: `Checked manual passage: ${p.locator}`,
          text: p.text,
          assessmentText: minimise(p.text, [action.name]),
          documentVersion: app.documentVersion,
          inputMethod: "manual",
        }));
        app.sourceFlag =
          "Manually transcribed passages: inspect against original. " +
          action.reason;
        app.assessments = Object.fromEntries(
          batch.rubric.map((c) => [
            c.id,
            {
              category: "UNCLEAR",
              initial: "UNCLEAR",
              evidence: [],
              rationale:
                "Manual handling requires your judgement and source evidence.",
              flagged: true,
              checked: false,
              reason: "",
            },
          ]),
        );
        batch.selected = [];
        batch.reason = "";
        batch.tieReason = "";
        batch.exceptions = {};
        break;
      }
      case "close":
        requireRule(
          batch.published && !batch.closed && batch.applications.length,
          "Publish criteria and add CVs before closing intake.",
        );
        requireRule(
          batch.applications.every(
            (a) => a.state === "ready" || a.state === "disposed",
          ),
          "Account for unreadable files before closing intake.",
        );
        batch.closed = true;
        break;
      case "review": {
        requireRule(batch.closed, "Close intake before review.");
        const app = batch.applications.find(
          (a) => a.id === action.applicationId,
        );
        requireRule(
          app && app.state === "ready",
          "Application is not available for review.",
        );
        requireRule(
          app.runId === action.runId &&
            app.documentVersion === action.documentVersion,
          "Document or assessment changed. Reload before saving.",
        );
        requireRule(
          Object.keys(action.decisions).length === batch.rubric.length &&
            Object.keys(action.decisions).every((k) =>
              batch.rubric.some((c) => c.id === k),
            ),
          "Review must contain the exact criterion set.",
        );
        for (const c of batch.rubric) {
          const original = app.assessments[c.id];
          const decision = action.decisions[c.id];
          const changed =
            decision.category !== original.category ||
            JSON.stringify(decision.evidence) !==
              JSON.stringify(original.evidence);
          if (changed) {
            requireRule(
              decision.reason.trim(),
              "Manual changes require a reason.",
            );
            requireRule(
              decision.checked,
              "Manual changes require an individual check.",
            );
          }
          app.assessments[c.id] = {
            ...original,
            ...decision,
            flagged: original.flagged || changed,
          };
          validateEvidence(app, app.assessments[c.id]);
        }
        app.sourceChecked = action.sourceChecked;
        app.confirmed = false;
        delete app.reviewedAt;
        delete app.reviewedBy;
        batch.selected = [];
        if (action.confirm) {
          requireRule(
            action.attest,
            "Confirm that you reviewed this CV and its source evidence.",
          );
          const errors = reviewBlockers(batch, app);
          requireRule(!errors.length, errors.join(" "));
          app.confirmed = true;
          app.reviewedAt = new Date().toISOString();
          app.reviewedBy = actor;
        }
        break;
      }
      case "selection": {
        requireRule(
          allReviewed(batch),
          "Review every active CV before selecting.",
        );
        requireRule(
          new Set(action.selected).size === action.selected.length,
          "Duplicate selection.",
        );
        requireRule(
          action.selected.every((id) =>
            batch.applications.some((a) => a.id === id && a.state === "ready"),
          ),
          "Selection must belong to this batch.",
        );
        batch.selected = action.selected;
        batch.reason = action.reason;
        batch.tieReason = action.tieReason;
        batch.exceptions = action.exceptions;
        break;
      }
      case "finalise": {
        requireRule(
          allReviewed(batch),
          "Review every active CV before finalising.",
        );
        requireRule(
          batch.selected.length <= 3 &&
            new Set(batch.selected).size === batch.selected.length,
          "Choose zero to three different applicants.",
        );
        requireRule(
          batch.reason.trim(),
          "Record a written selection reason, including when selecting nobody.",
        );
        requireRule(
          !boundaryTie(batch, batch.selected) || batch.tieReason.trim(),
          "Record a human decision for the boundary tie.",
        );
        batch.selected.forEach((id) => {
          const app = batch.applications.find(
            (a) => a.id === id && a.state === "ready",
          );
          requireRule(app, "Invalid selected application.");
          requireRule(
            !unmetEssentials(batch, app).length || batch.exceptions[id]?.trim(),
            "Document an exception for each selected applicant with unmet essentials.",
          );
        });
        batch.snapshot = {
          at: new Date().toISOString(),
          actor,
          reason: batch.reason,
          tieReason: batch.tieReason,
          exceptions: structuredClone(batch.exceptions),
          selected: [...batch.selected],
          rubricVersion: batch.rubricVersion,
          rubric: structuredClone(batch.rubric),
          applications: batch.applications.map((a) => ({
            id: a.id,
            score: score(batch, a),
            disposition: a.disposition,
            dispositionReason: a.dispositionReason,
            assessments: structuredClone(a.assessments),
            blocks: structuredClone(a.blocks),
            documentVersion: a.documentVersion,
            runId: a.runId,
            reviewedBy: a.reviewedBy,
            reviewedAt: a.reviewedAt,
          })),
        };
        break;
      }
      case "next":
        requireRule(batch.snapshot, "Finish the current batch first.");
        vacancy.batches.push({
          id: makeId(),
          label: action.label,
          rubric: structuredClone(batch.rubric),
          rubricVersion: batch.rubricVersion + 1,
          published: false,
          closed: false,
          applications: [],
          selected: [],
          reason: "",
          tieReason: "",
          exceptions: {},
        });
        break;
    }
  }
  next.version++;
  next.audit.push({
    at: new Date().toISOString(),
    actor,
    operation: action.type,
    entity: "batchId" in action ? action.batchId : next.vacancies.at(-1)!.id,
  });
  return next;
}
// Display-only anonymous label, numbered by arrival position. The
// applications array is append-only and disposal never removes or reorders
// entries, so a candidate keeps its number for the life of the batch.
export function candidateLabel(index: number, total: number) {
  const width = Math.max(2, String(Math.max(total, index + 1)).length);
  return `Candidate ${String(index + 1).padStart(width, "0")}`;
}
export function publicState(state: Workspace, reveal = false) {
  return {
    ...state,
    audit: undefined,
    vacancies: state.vacancies.map((v) => ({
      ...v,
      batches: v.batches.map((b) => {
        const labelOf = (id: string) =>
          candidateLabel(
            b.applications.findIndex((a) => a.id === id),
            b.applications.length,
          );
        return {
          ...b,
          ranking: allReviewed(b) ? ranking(b) : null,
          snapshot: b.snapshot
            ? {
                ...b.snapshot,
                applications: b.snapshot.applications.map((a) => ({
                  ...a,
                  label: labelOf(a.id),
                  blocks: a.blocks.map((block) => ({
                    ...block,
                    text: block.assessmentText ?? block.text,
                  })),
                })),
              }
            : undefined,
          applications: b.applications.map((a, i) => ({
            ...a,
            label: candidateLabel(i, b.applications.length),
            blocks: a.blocks.map((block) => ({
              ...block,
              text: block.assessmentText ?? block.text,
            })),
            name: reveal && allReviewed(b) ? a.name : undefined,
            score: allReviewed(b) ? score(b, a) : null,
            blockers: reviewBlockers(b, a),
          })),
        };
      }),
    })),
  };
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportBatch(vacancy: Vacancy, batch: Batch) {
  requireRule(batch.snapshot, "Only finalised snapshots can be exported.");
  const s = batch.snapshot;
  return (
    "\ufeff" +
    [
      [
        "SYNTHETIC DATA ONLY",
        "Vacancy",
        "Batch",
        "Applicant ID",
        "Score",
        "Selected",
        "Disposition",
        "Selection reason",
        "Tie reason",
        "Essential exception",
      ],
      ...s.applications.map((a) => [
        "Fictional applicant",
        vacancy.title,
        batch.label,
        a.id,
        a.score ?? "",
        s.selected.includes(a.id) ? "Yes" : "No",
        a.disposition ?? "",
        s.reason,
        s.tieReason,
        s.exceptions[a.id] ?? "",
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}

// The zod schemas and the plain rule types must describe the same shapes.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const schemaMatchesRules: [
  Same<Category, RuleCategory>,
  Same<Criterion, RuleCriterion>,
] = [true, true];
