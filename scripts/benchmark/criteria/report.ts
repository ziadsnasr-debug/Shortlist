// Markdown tables for the benchmark write-up. Pure formatting, no I/O.
import { ALL_ARMS } from "./arms";
import {
  CATEGORIES,
  type ConfirmDecision,
  type Decision,
  type Summary,
} from "./metrics";

const pct = (x: number) =>
  Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "n/a";

export function markdownReport(
  summary: Summary,
  decision: Decision | null,
  confirm: ConfirmDecision | null = null,
): string {
  const out: string[] = [];
  const rows = Object.entries(summary.arms).flatMap(([id, arm]) =>
    (arm?.repeats ?? []).map((m) => ({
      id,
      m,
      arm: ALL_ARMS.find((a) => a.id === id),
    })),
  );
  out.push(
    "### Headline metrics",
    "",
    "| Arm | Repeat | Cells | Valid passes | Pass disagreement | UNCLEAR total | from disagreement | from invalid pass | model-asserted | Strict | Excl. debatable | Accept either |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      ({ id, m }) =>
        `| ${id} | ${m.repeat} | ${m.cells} | ${pct(m.validPassRate)} | ${pct(m.disagreementRate)} | ${pct(m.unclearRate)} | ${pct(m.unclearFromDisagreement)} | ${pct(m.unclearFromInvalidPass)} | ${pct(m.unclearModelAsserted)} | ${pct(m.agreementStrict)} | ${pct(m.agreementExcludingDebatable)} | ${pct(m.agreementAcceptEither)} |`,
    ),
    "",
    "### Evidence, risk and injection",
    "",
    "| Arm | Repeat | Pass 1 agree | Pass 2 agree | Evidence exact | Exact (FULL/PARTIAL) | Superset (FULL/PARTIAL) | Essential FULL FP | Essential FULL FN | Unsupported credit | Under-credit | Injection cited |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      ({ id, m }) =>
        `| ${id} | ${m.repeat} | ${pct(m.perPassAgreement.pass1.rate)} | ${pct(m.perPassAgreement.pass2.rate)} | ${pct(m.evidenceExact)} | ${pct(m.evidenceExactFullPartial)} | ${pct(m.evidenceSuperset)} | ${m.essentialFalsePositives}/${m.essentialCells} | ${m.essentialFalseNegatives}/${m.essentialCells} | ${m.unsupportedCredit} (${pct(m.unsupportedCreditRate)}) | ${m.underCredit} (${pct(m.underCreditRate)}) | ${m.injectionCitedCells} |`,
    ),
    "",
    "### Noise floor (between-repeat changed cells)",
    "",
    "| Arm | Changed fraction |",
    "|---|---|",
    ...Object.entries(summary.arms)
      .filter(([, arm]) => arm && arm.noiseFloor !== null)
      .map(([id, arm]) => `| ${id} | ${pct(arm!.noiseFloor!)} |`),
    "",
    "### Confusion matrices (rows expected, columns guarded)",
  );
  for (const { id, m } of rows) {
    out.push(
      "",
      `Arm ${id}, repeat ${m.repeat}`,
      "",
      `| expected \\ guarded | ${CATEGORIES.join(" | ")} |`,
      `|---|${CATEGORIES.map(() => "---").join("|")}|`,
      ...CATEGORIES.map((c, i) => `| ${c} | ${m.confusion[i].join(" | ")} |`),
    );
  }
  if (decision)
    out.push(
      "",
      `### Decision: ${decision.verdict}`,
      "",
      "| # | Condition | Result | Detail |",
      "|---|---|---|---|",
      ...decision.conditions.map(
        (c) =>
          `| ${c.id} | ${c.text} | ${c.pass ? "pass" : "fail"} | ${c.detail} |`,
      ),
      "",
      "| Metric (mean of repeats) | A | B | Delta | Reading |",
      "|---|---|---|---|---|",
      ...decision.comparisons.map(
        (c) =>
          `| ${c.metric} | ${pct(c.a)} | ${pct(c.b)} | ${Number.isFinite(c.delta) ? (c.delta * 100).toFixed(1) + " pts" : "n/a"} | ${c.verdict} |`,
      ),
    );
  if (confirm)
    out.push(
      "",
      `### Confirmation decision (E vs control B): ${confirm.verdict}`,
      "",
      "| # | Condition | Result | Detail |",
      "|---|---|---|---|",
      ...confirm.conditions.map(
        (c) =>
          `| ${c.id} | ${c.text} | ${c.pass ? "pass" : "fail"} | ${c.detail} |`,
      ),
      "",
      "| Metric (mean of repeats) | B | E | Delta | Reading |",
      "|---|---|---|---|---|",
      ...confirm.comparisons.map(
        (c) =>
          `| ${c.metric} | ${pct(c.b)} | ${pct(c.e)} | ${Number.isFinite(c.delta) ? (c.delta * 100).toFixed(1) + " pts" : "n/a"} | ${c.verdict} |`,
      ),
      "",
      "Arm D is reference only and does not enter the decision.",
    );
  return out.join("\n");
}
