import { z } from "zod";
import {
  Category,
  type Application,
  type Criterion,
  requireRule,
} from "./workflow";
export const OutputSchema = z
  .object({
    criteria: z
      .array(
        z
          .object({
            criterion_id: z.string().min(1).max(80),
            category: Category,
            evidence_ids: z.array(z.string().min(1).max(100)).max(30),
            rationale: z
              .string()
              .trim()
              .min(1)
              .max(1000)
              .refine((t) => t.split(/\s+/).length <= 25, "Maximum 25 words."),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
export function validatePass(
  input: unknown,
  rubric: Criterion[],
  app: Application,
) {
  const result = OutputSchema.parse(input);
  requireRule(
    result.criteria.length === rubric.length,
    "Exact criterion set required.",
  );
  requireRule(
    new Set(result.criteria.map((c) => c.criterion_id)).size === rubric.length,
    "Duplicate criteria.",
  );
  for (const c of result.criteria) {
    requireRule(
      rubric.some((r) => r.id === c.criterion_id),
      "Foreign criterion.",
    );
    requireRule(
      new Set(c.evidence_ids).size === c.evidence_ids.length,
      "Duplicate evidence.",
    );
    requireRule(
      c.evidence_ids.every((id) =>
        app.blocks.some(
          (b) => b.id === id && b.documentVersion === app.documentVersion,
        ),
      ),
      "Foreign or stale evidence.",
    );
    requireRule(
      !["FULL", "PARTIAL"].includes(c.category) || c.evidence_ids.length > 0,
      "Support required.",
    );
  }
  return result;
}
export function mergePasses(
  first: unknown,
  second: unknown,
  rubric: Criterion[],
  app: Application,
) {
  let a: ReturnType<typeof validatePass> | undefined,
    b: ReturnType<typeof validatePass> | undefined;
  try {
    a = validatePass(first, rubric, app);
  } catch {}
  try {
    b = validatePass(second, rubric, app);
  } catch {}
  return Object.fromEntries(
    rubric.map((c) => {
      const x = a?.criteria.find((r) => r.criterion_id === c.id),
        y = b?.criteria.find((r) => r.criterion_id === c.id);
      const category =
        x && y && x.category === y.category ? x.category : "UNCLEAR";
      return [
        c.id,
        {
          category,
          initial: category,
          evidence: [
            ...new Set([
              ...(x?.evidence_ids ?? []),
              ...(y?.evidence_ids ?? []),
            ]),
          ],
          rationale:
            category === "UNCLEAR"
              ? "Assessment passes need your judgement. Inspect the source passages."
              : x!.rationale,
          flagged: category === "UNCLEAR",
          checked: false,
          reason: "",
        },
      ];
    }),
  );
}
