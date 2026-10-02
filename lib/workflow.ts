import { z } from "zod";
import { minimise } from "./minimisation";

export const Category = z.enum(["FULL", "PARTIAL", "NOT_EVIDENCED", "UNCLEAR"]);
export type Category = z.infer<typeof Category>;
export const labels: Record<Category, string> = {
  FULL: "Full evidence",
  PARTIAL: "Partial evidence",
  NOT_EVIDENCED: "Not evidenced in this CV",
  UNCLEAR: "Needs your judgement",
};
export const Criterion = z
  .object({
    id: z.string().min(1).max(80),
    section: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(200),
    points: z.number().int().positive().max(100),
    essential: z.boolean(),
    full: z.string().trim().min(1).max(1000),
    partial: z.string().trim().min(1).max(1000),
  })
  .strict();
export type Criterion = z.infer<typeof Criterion>;
export type Block = {
  id: string;
  text: string;
  locator: string;
  documentVersion: number;
  assessmentText?: string;
  inputMethod?: "parsed" | "manual";
};
export type Assessment = {
  category: Category;
  initial: Category;
  evidence: string[];
  rationale: string;
  flagged: boolean;
  checked: boolean;
  reason: string;
};
export type Application = {
  id: string;
  name: string;
  file: string;
  state: "ready" | "readable_copy" | "disposed" | "processing" | "attention";
  disposition?: string;
  dispositionReason?: string;
  documentVersion: number;
  runId: string;
  rubricVersion: number;
  assessments: Record<string, Assessment>;
  blocks: Block[];
  sourceFlag?: string;
  sourceChecked: boolean;
  confirmed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
};
export type Snapshot = {
  at: string;
  actor: string;
  reason: string;
  tieReason: string;
  exceptions: Record<string, string>;
  selected: string[];
  rubricVersion: number;
  rubric: Criterion[];
  applications: {
    id: string;
    score: number | null;
    disposition?: string;
    dispositionReason?: string;
    assessments: Record<string, Assessment>;
    blocks: Block[];
    documentVersion: number;
    runId: string;
    reviewedBy?: string;
    reviewedAt?: string;
  }[];
};
export type Batch = {
  id: string;
  label: string;
  rubric: Criterion[];
  rubricVersion: number;
  published: boolean;
  closed: boolean;
  applications: Application[];
  selected: string[];
  reason: string;
  tieReason: string;
  exceptions: Record<string, string>;
  snapshot?: Snapshot;
};
export type Vacancy = {
  id: string;
  title: string;
  team: string;
  description: string;
  batches: Batch[];
};
export type Workspace = {
  version: number;
  vacancies: Vacancy[];
  audit: { at: string; actor: string; operation: string; entity: string }[];
};
export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new WorkflowError(message);
}
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
export function validateEvidence(app: Application, a: Assessment) {
  requireRule(
    new Set(a.evidence).size === a.evidence.length,
    "Evidence references must be unique.",
  );
  requireRule(
    a.evidence.every((id) =>
      app.blocks.some(
        (b) => b.id === id && b.documentVersion === app.documentVersion,
      ),
    ),
    "Evidence must belong to this document version.",
  );
  requireRule(
    !["FULL", "PARTIAL"].includes(a.category) || a.evidence.length > 0,
    "Credited evidence requires a source passage.",
  );
}
export function individualCheck(c: Criterion, a: Assessment) {
  return (
    c.essential ||
    a.flagged ||
    a.initial === "UNCLEAR" ||
    a.category !== a.initial ||
    !!a.reason
  );
}
export function reviewBlockers(batch: Batch, app: Application): string[] {
  const errors: string[] = [];
  if (!batch.closed) errors.push("Close intake before confirming a CV.");
  if (app.state !== "ready")
    errors.push("Resolve the document status before review.");
  if (app.rubricVersion !== batch.rubricVersion)
    errors.push("Assessment uses stale criteria.");
  if (Object.keys(app.assessments).length !== batch.rubric.length)
    errors.push("Assessment set is incomplete.");
  if (app.sourceFlag && !app.sourceChecked)
    errors.push("Check the flagged source content.");
  for (const c of batch.rubric) {
    const a = app.assessments[c.id];
    if (!a) {
      errors.push(`${c.title}: missing assessment.`);
      continue;
    }
    if (a.category === "UNCLEAR")
      errors.push(`${c.title}: needs your judgement.`);
    try {
      validateEvidence(app, a);
    } catch (e) {
      errors.push(`${c.title}: ${(e as Error).message}`);
    }
    if (individualCheck(c, a) && !a.checked)
      errors.push(`${c.title}: individual check required.`);
    if (
      (a.flagged || a.initial === "UNCLEAR" || a.category !== a.initial) &&
      !a.reason.trim()
    )
      errors.push(`${c.title}: explain your decision.`);
  }
  return errors;
}
export function score(batch: Batch, app: Application): number | null {
  if (!app.confirmed || reviewBlockers(batch, app).length) return null;
  const multipliers: Record<Category, number> = {
    FULL: 2,
    PARTIAL: 1,
    NOT_EVIDENCED: 0,
    UNCLEAR: 0,
  };
  return (
    batch.rubric.reduce(
      (units, c) =>
        units + c.points * multipliers[app.assessments[c.id].category],
      0,
    ) / 2
  );
}
export function allReviewed(batch: Batch) {
  return (
    batch.closed &&
    batch.applications.length > 0 &&
    batch.applications.every(
      (a) => a.state === "disposed" || score(batch, a) !== null,
    )
  );
}
export function unmetEssentials(batch: Batch, app: Application) {
  return batch.rubric
    .filter((c) => c.essential && app.assessments[c.id]?.category !== "FULL")
    .map((c) => c.title);
}
export function ranking(batch: Batch) {
  requireRule(
    allReviewed(batch),
    "Review every active CV before comparing scores.",
  );
  return batch.applications
    .filter((a) => a.state !== "disposed")
    .map((a) => ({
      id: a.id,
      score: score(batch, a)!,
      essentials: unmetEssentials(batch, a),
    }))
    .sort((a, b) => b.score - a.score);
}
export function boundaryTie(batch: Batch, selected: string[]) {
  const rows = ranking(batch);
  if (!selected.length) return false;
  const minimum = Math.min(
    ...rows.filter((r) => selected.includes(r.id)).map((r) => r.score),
  );
  return rows.some((r) => !selected.includes(r.id) && r.score === minimum);
}
export function highest(batch: Batch) {
  const rows = ranking(batch);
  let end = Math.min(3, rows.length);
  if (rows.length > 3 && rows[2].score === rows[3].score) {
    const tied = rows[2].score;
    while (end > 0 && rows[end - 1].score === tied) end--;
  }
  return rows.slice(0, end).map((r) => r.id);
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
export function publicState(state: Workspace, reveal = false) {
  return {
    ...state,
    audit: undefined,
    vacancies: state.vacancies.map((v) => ({
      ...v,
      batches: v.batches.map((b) => ({
        ...b,
        ranking: allReviewed(b) ? ranking(b) : null,
        snapshot: b.snapshot
          ? {
              ...b.snapshot,
              applications: b.snapshot.applications.map((a) => ({
                ...a,
                blocks: a.blocks.map((block) => ({
                  ...block,
                  text: block.assessmentText ?? block.text,
                })),
              })),
            }
          : undefined,
        applications: b.applications.map((a) => ({
          ...a,
          blocks: a.blocks.map((block) => ({
            ...block,
            text: block.assessmentText ?? block.text,
          })),
          name: reveal && allReviewed(b) ? a.name : undefined,
          score: allReviewed(b) ? score(b, a) : null,
          blockers: reviewBlockers(b, a),
        })),
      })),
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
