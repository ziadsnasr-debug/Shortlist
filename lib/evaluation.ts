import { createHash } from "node:crypto";
import { z } from "zod";
import { Category } from "./workflow";
export const EvaluationRow = z
  .object({
    fixtureId: z.string().min(1),
    role: z.string().min(1),
    criterionId: z.string().min(1),
    expected: Category,
    actual: Category.nullable(),
    validSupport: z.boolean(),
    essential: z.boolean(),
    essentialReviewed: z.boolean(),
    humanLabelledBy: z.string().min(1),
    independentOfModel: z.literal(true),
  })
  .strict();
export type EvaluationRow = z.infer<typeof EvaluationRow>;
export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function evaluate(input: unknown) {
  const rows = z.array(EvaluationRow).min(1).parse(input),
    keys = rows.map((r) => `${r.fixtureId}:${r.criterionId}`);
  if (new Set(keys).size !== keys.length)
    throw new Error("Duplicate evaluation rows.");
  const exact = rows.filter((r) => r.actual === r.expected).length,
    unsupported = rows.filter(
      (r) => ["FULL", "PARTIAL"].includes(r.actual ?? "") && !r.validSupport,
    ).length,
    perRole = Object.fromEntries(
      [...new Set(rows.map((r) => r.role))].map((role) => {
        const s = rows.filter((r) => r.role === role);
        return [
          role,
          {
            count: s.length,
            agreement:
              s.filter((r) => r.actual === r.expected).length / s.length,
          },
        ];
      }),
    );
  return {
    count: rows.length,
    agreement: exact / rows.length,
    perRole,
    perCategory: Object.fromEntries(
      Category.options.map((c) => [
        c,
        {
          count: rows.filter((r) => r.expected === c).length,
          exact: rows.filter((r) => r.expected === c && r.actual === c).length,
        },
      ]),
    ),
    invalidOrMissing: rows.filter((r) => r.actual === null).length,
    unsupported,
    essentialUnreviewed: rows.filter((r) => r.essential && !r.essentialReviewed)
      .length,
    proposedQualityThresholdsMet: false,
    releaseStatus: "not_assessed" as const,
    releaseReason:
      "Rows alone cannot establish frozen coverage, configuration, independent evidence or release approval.",
  };
}
export function repeatability(runs: (Category | null)[][]) {
  if (
    runs.length !== 3 ||
    !runs[0].length ||
    runs.some((r) => r.length !== runs[0].length)
  )
    throw new Error("Three matched runs required.");
  return {
    items: runs[0].length,
    changed: runs[0].filter((c, i) => c !== runs[1][i] || c !== runs[2][i])
      .length,
  };
}
export function timedComparison(manual: number[], assisted: number[]) {
  if (
    manual.length !== 3 ||
    assisted.length !== 3 ||
    [...manual, ...assisted].some((n) => !Number.isFinite(n) || n <= 0)
  )
    throw new Error("Three actual paired timings required.");
  return manual.map((m, i) => ({
    manualSeconds: m,
    assistedSeconds: assisted[i],
    reduction: 1 - assisted[i] / m,
    targetMet: assisted[i] <= m * 0.75,
  }));
}
