// Pure workflow rules shared by the server and the browser. No validation
// library here, so client components can import it without shipping zod.
export type Category = "FULL" | "PARTIAL" | "NOT_EVIDENCED" | "UNCLEAR";
export const labels: Record<Category, string> = {
  FULL: "Full evidence",
  PARTIAL: "Partial evidence",
  NOT_EVIDENCED: "Not evidenced in this CV",
  UNCLEAR: "Needs your judgement",
};
export type Criterion = {
  id: string;
  section: string;
  title: string;
  points: number;
  essential: boolean;
  full: string;
  partial: string;
};
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
