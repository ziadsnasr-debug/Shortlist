import { z } from "zod";
import { Category } from "./workflow";
export const EvaluationRow = z
  .object({
    fixtureId: z.string(),
    role: z.string(),
    criterionId: z.string(),
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
export function evaluate(input: unknown) {
  const rows = z.array(EvaluationRow).min(1).parse(input);
  const keys = rows.map((r) => `${r.fixtureId}:${r.criterionId}`);
  if (new Set(keys).size !== keys.length)
    throw new Error("Duplicate evaluation rows.");
  const exact = rows.filter((r) => r.actual === r.expected).length,
    unsupported = rows.filter(
      (r) => ["FULL", "PARTIAL"].includes(r.actual ?? "") && !r.validSupport,
    ).length;
  const perRole = Object.fromEntries(
    [...new Set(rows.map((r) => r.role))].map((role) => {
      const subset = rows.filter((r) => r.role === role);
      return [
        role,
        {
          count: subset.length,
          agreement:
            subset.filter((r) => r.actual === r.expected).length /
            subset.length,
        },
      ];
    }),
  );
  const perCategory = Object.fromEntries(
    Category.options.map((c) => {
      const subset = rows.filter((r) => r.expected === c);
      return [
        c,
        {
          count: subset.length,
          exact: subset.filter((r) => r.actual === c).length,
        },
      ];
    }),
  );
  return {
    count: rows.length,
    agreement: exact / rows.length,
    perRole,
    perCategory,
    invalidOrMissing: rows.filter((r) => r.actual === null).length,
    unsupported,
    essentialUnreviewed: rows.filter((r) => r.essential && !r.essentialReviewed)
      .length,
    proposedQualityThresholdsMet:
      exact / rows.length >= 0.85 &&
      Object.values(perRole).every((r) => r.agreement >= 0.8) &&
      unsupported === 0 &&
      rows.every((r) => !r.essential || r.essentialReviewed),
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
