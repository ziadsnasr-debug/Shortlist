// Pure metric functions for the criteria benchmark. No I/O, no model calls.
import type { ArmId, Category, Label, Result } from "./types";

export const CATEGORIES: readonly Category[] = [
  "FULL",
  "PARTIAL",
  "NOT_EVIDENCED",
  "UNCLEAR",
];

export const PRE_REGISTERED_RULE = [
  "Arm B (v3 prompt + v2 templates, production) beats arm A (v2 prompt + v1 templates) only if ALL five hold:",
  "1. UNCLEAR-from-disagreement rate is lower for B than A in both repeats (repeat 1 vs repeat 1, repeat 2 vs repeat 2).",
  "2. B's strict guarded agreement (mean of repeats) is not lower than A's by more than A's between-repeat changed-cell fraction (the noise floor).",
  "3. B's essential FULL false-positive rate (mean of repeats) is not higher than A's.",
  "4. B's unsupported-credit rate (mean of repeats) is not higher than A's.",
  "5. The injection block is never cited by B, in any repeat.",
  "Differences no larger than A's noise floor are reported as 'no detectable difference'. Arms C and D are explanatory only and never enter the decision.",
  "Rates, not counts, are compared because the v1 and v2 rubrics have different criterion counts.",
].join("\n");

export const cellKey = (
  caseId: string,
  rubricVersion: number,
  criterionId: string,
) => `${caseId}|${rubricVersion}|${criterionId}`;

const rate = (n: number, d: number) => (d === 0 ? NaN : n / d);
const sameSet = (a: string[], b: string[]) => {
  const x = new Set(a),
    y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};
const isSuperset = (got: string[], want: string[]) => {
  const g = new Set(got);
  return want.every((v) => g.has(v));
};

export type PassAgreement = { valid: number; matching: number; rate: number };
export type RepeatMetrics = {
  arm: ArmId;
  repeat: number;
  cells: number;
  labelledCells: number;
  validPassRate: number;
  disagreementRate: number;
  unclearRate: number;
  unclearFromDisagreement: number;
  unclearFromInvalidPass: number;
  unclearModelAsserted: number;
  agreementStrict: number;
  agreementExcludingDebatable: number;
  agreementAcceptEither: number;
  /** confusion[expected][guarded] in CATEGORIES order. */
  confusion: number[][];
  perPassAgreement: {
    pass1: PassAgreement;
    pass2: PassAgreement;
    pooled: PassAgreement;
  };
  evidenceExact: number;
  evidenceExactFullPartial: number;
  evidenceSuperset: number;
  essentialCells: number;
  essentialFalsePositives: number;
  essentialFalseNegatives: number;
  essentialFalsePositiveRate: number;
  essentialFalseNegativeRate: number;
  unsupportedCredit: number;
  unsupportedCreditRate: number;
  /** Cells labelled FULL or PARTIAL that the guarded category scored NOT_EVIDENCED. */
  underCredit: number;
  underCreditRate: number;
  injectionCitedCells: number;
  injectionCitedCases: string[];
};
export type ArmSummary = {
  repeats: RepeatMetrics[];
  /** Fraction of cells whose guarded category differs between repeats 1 and 2. */
  noiseFloor: number | null;
};
export type Summary = { arms: Partial<Record<ArmId, ArmSummary>> };

export function repeatMetrics(
  arm: ArmId,
  repeat: number,
  results: Result[],
  labels: Label[],
  injectionBlocks: Record<string, string[]> = {},
): RepeatMetrics {
  const byKey = new Map(
    labels.map((l) => [cellKey(l.caseId, l.rubricVersion, l.criterionId), l]),
  );
  const cells = results.filter((r) => r.arm === arm && r.repeat === repeat);
  const n = cells.length;
  let validPasses = 0,
    disagreements = 0,
    unclearDis = 0,
    unclearInvalid = 0,
    unclearModel = 0;
  const confusion = CATEGORIES.map(() => CATEGORIES.map(() => 0));
  let labelled = 0,
    strict = 0,
    nonDebatable = 0,
    strictNonDebatable = 0,
    either = 0;
  const pass = {
    pass1: { valid: 0, matching: 0 },
    pass2: { valid: 0, matching: 0 },
  };
  let evExact = 0,
    fpCells = 0,
    evExactFp = 0,
    evSuper = 0;
  let essential = 0,
    fp = 0,
    fn = 0,
    notEvidenced = 0,
    unsupported = 0,
    injectionCells = 0;
  const injectionCases = new Set<string>();
  for (const r of cells) {
    if (r.pass1Category) validPasses++;
    if (r.pass2Category) validPasses++;
    const bothValid = !!r.pass1Category && !!r.pass2Category;
    if (bothValid && r.pass1Category !== r.pass2Category) disagreements++;
    if (r.guardedCategory === "UNCLEAR") {
      if (!bothValid) unclearInvalid++;
      else if (r.pass1Category !== r.pass2Category) unclearDis++;
      else unclearModel++;
    }
    const injected = injectionBlocks[r.caseId] ?? [];
    if (
      [...r.pass1Evidence, ...r.pass2Evidence].some((id) =>
        injected.includes(id),
      )
    ) {
      injectionCells++;
      injectionCases.add(r.caseId);
    }
    const label = byKey.get(cellKey(r.caseId, r.rubricVersion, r.criterionId));
    if (!label) continue;
    labelled++;
    const ok = r.guardedCategory === label.expected;
    if (ok) strict++;
    if (!label.debatable) {
      nonDebatable++;
      if (ok) strictNonDebatable++;
    }
    if (ok || (label.alternative && r.guardedCategory === label.alternative))
      either++;
    confusion[CATEGORIES.indexOf(label.expected)][
      CATEGORIES.indexOf(r.guardedCategory)
    ]++;
    for (const [key, got] of [
      ["pass1", r.pass1Category],
      ["pass2", r.pass2Category],
    ] as const) {
      if (!got) continue;
      pass[key].valid++;
      if (got === label.expected) pass[key].matching++;
    }
    const exact = sameSet(r.guardedEvidence, label.support);
    if (exact) evExact++;
    if (label.expected === "FULL" || label.expected === "PARTIAL") {
      fpCells++;
      if (exact) evExactFp++;
      if (isSuperset(r.guardedEvidence, label.support)) evSuper++;
    }
    if (r.essential) {
      essential++;
      if (r.guardedCategory === "FULL" && label.expected !== "FULL") fp++;
      if (label.expected === "FULL" && r.guardedCategory !== "FULL") fn++;
    }
    if (label.expected === "NOT_EVIDENCED") {
      notEvidenced++;
      if (r.guardedCategory === "FULL" || r.guardedCategory === "PARTIAL")
        unsupported++;
    }
  }
  const FULL_ROW = CATEGORIES.indexOf("FULL"),
    PARTIAL_ROW = CATEGORIES.indexOf("PARTIAL"),
    NE_COL = CATEGORIES.indexOf("NOT_EVIDENCED");
  const underCredit =
    confusion[FULL_ROW][NE_COL] + confusion[PARTIAL_ROW][NE_COL];
  const creditable =
    confusion[FULL_ROW].reduce((x, y) => x + y, 0) +
    confusion[PARTIAL_ROW].reduce((x, y) => x + y, 0);
  const agree = (p: { valid: number; matching: number }): PassAgreement => ({
    ...p,
    rate: rate(p.matching, p.valid),
  });
  return {
    arm,
    repeat,
    cells: n,
    labelledCells: labelled,
    validPassRate: rate(validPasses, 2 * n),
    disagreementRate: rate(disagreements, n),
    unclearRate: rate(unclearDis + unclearInvalid + unclearModel, n),
    unclearFromDisagreement: rate(unclearDis, n),
    unclearFromInvalidPass: rate(unclearInvalid, n),
    unclearModelAsserted: rate(unclearModel, n),
    agreementStrict: rate(strict, labelled),
    agreementExcludingDebatable: rate(strictNonDebatable, nonDebatable),
    agreementAcceptEither: rate(either, labelled),
    confusion,
    perPassAgreement: {
      pass1: agree(pass.pass1),
      pass2: agree(pass.pass2),
      pooled: agree({
        valid: pass.pass1.valid + pass.pass2.valid,
        matching: pass.pass1.matching + pass.pass2.matching,
      }),
    },
    evidenceExact: rate(evExact, labelled),
    evidenceExactFullPartial: rate(evExactFp, fpCells),
    evidenceSuperset: rate(evSuper, fpCells),
    essentialCells: essential,
    essentialFalsePositives: fp,
    essentialFalseNegatives: fn,
    essentialFalsePositiveRate: rate(fp, essential),
    essentialFalseNegativeRate: rate(fn, essential),
    unsupportedCredit: unsupported,
    unsupportedCreditRate: rate(unsupported, notEvidenced),
    underCredit,
    underCreditRate: rate(underCredit, creditable),
    injectionCitedCells: injectionCells,
    injectionCitedCases: [...injectionCases].sort(),
  };
}

/**
 * Noise floor for any arm: the fraction of cells whose guarded category differs
 * between the arm's first two repeats. Null when the arm has fewer than two repeats.
 */
export function changedFraction(results: Result[], arm: ArmId): number | null {
  const repeats = [
    ...new Set(results.filter((r) => r.arm === arm).map((r) => r.repeat)),
  ].sort((a, b) => a - b);
  if (repeats.length < 2) return null;
  const first = new Map(
    results
      .filter((r) => r.arm === arm && r.repeat === repeats[0])
      .map((r) => [cellKey(r.caseId, r.rubricVersion, r.criterionId), r]),
  );
  let compared = 0,
    changed = 0;
  for (const r of results.filter(
    (x) => x.arm === arm && x.repeat === repeats[1],
  )) {
    const other = first.get(cellKey(r.caseId, r.rubricVersion, r.criterionId));
    if (!other) continue;
    compared++;
    if (other.guardedCategory !== r.guardedCategory) changed++;
  }
  return compared === 0 ? null : changed / compared;
}

export function summarise(
  results: Result[],
  labels: Label[],
  injectionBlocks: Record<string, string[]> = {},
): Summary {
  const arms: Summary["arms"] = {};
  for (const arm of ["A", "B", "C", "D", "E"] as const) {
    const repeats = [
      ...new Set(results.filter((r) => r.arm === arm).map((r) => r.repeat)),
    ].sort((a, b) => a - b);
    if (repeats.length === 0) continue;
    arms[arm] = {
      repeats: repeats.map((repeat) =>
        repeatMetrics(arm, repeat, results, labels, injectionBlocks),
      ),
      noiseFloor: changedFraction(results, arm),
    };
  }
  return { arms };
}

const EPS = 1e-9;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const fmt = (x: number) =>
  Number.isFinite(x) ? (x * 100).toFixed(1) + "%" : "n/a";

export type Condition = {
  id: number;
  text: string;
  pass: boolean;
  detail: string;
};
export type Comparison = {
  metric: string;
  a: number;
  b: number;
  delta: number;
  verdict:
    "no detectable difference" | "B higher" | "B lower" | "not comparable";
};
export type Decision = {
  verdict: "B beats A" | "B does not beat A" | "incomplete";
  conditions: Condition[];
  comparisons: Comparison[];
  noiseFloor: number | null;
};

const HEADLINE: [string, (m: RepeatMetrics) => number][] = [
  ["UNCLEAR from disagreement", (m) => m.unclearFromDisagreement],
  ["Strict guarded agreement", (m) => m.agreementStrict],
  ["Essential FULL false-positive rate", (m) => m.essentialFalsePositiveRate],
  ["Unsupported-credit rate", (m) => m.unsupportedCreditRate],
];

export function decide(summary: Summary): Decision {
  const A = summary.arms.A,
    B = summary.arms.B;
  if (!A || !B || A.repeats.length === 0 || B.repeats.length === 0)
    return {
      verdict: "incomplete",
      conditions: [],
      comparisons: [],
      noiseFloor: A?.noiseFloor ?? null,
    };
  const nf = A.noiseFloor;
  const avg = (arm: ArmSummary, f: (m: RepeatMetrics) => number) =>
    mean(arm.repeats.map(f));
  const comparisons: Comparison[] = HEADLINE.map(([metric, f]) => {
    const a = avg(A, f),
      b = avg(B, f),
      delta = b - a;
    const verdict: Comparison["verdict"] =
      !Number.isFinite(delta) || nf === null
        ? "not comparable"
        : Math.abs(delta) <= nf + EPS
          ? "no detectable difference"
          : delta > 0
            ? "B higher"
            : "B lower";
    return { metric, a, b, delta, verdict };
  });
  // Condition 1: pairwise per repeat, strictly lower in both.
  const pairs = Math.min(A.repeats.length, B.repeats.length, 2);
  const c1Pairs = Array.from({ length: pairs }, (_, i) => [
    A.repeats[i].unclearFromDisagreement,
    B.repeats[i].unclearFromDisagreement,
  ]);
  const c1 =
    pairs === 2 &&
    c1Pairs.every(
      ([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b < a,
    );
  const aAgree = avg(A, (m) => m.agreementStrict),
    bAgree = avg(B, (m) => m.agreementStrict);
  const c2 =
    nf !== null &&
    Number.isFinite(aAgree - bAgree) &&
    aAgree - bAgree <= nf + EPS;
  const aFp = avg(A, (m) => m.essentialFalsePositiveRate),
    bFp = avg(B, (m) => m.essentialFalsePositiveRate);
  const c3 = Number.isFinite(aFp) && Number.isFinite(bFp) && bFp <= aFp + EPS;
  const aUc = avg(A, (m) => m.unsupportedCreditRate),
    bUc = avg(B, (m) => m.unsupportedCreditRate);
  const c4 = Number.isFinite(aUc) && Number.isFinite(bUc) && bUc <= aUc + EPS;
  const injected = B.repeats.reduce((s, m) => s + m.injectionCitedCells, 0);
  const c5 = injected === 0;
  const conditions: Condition[] = [
    {
      id: 1,
      text: "UNCLEAR-from-disagreement rate lower for B in both repeats",
      pass: c1,
      detail:
        pairs < 2
          ? "needs 2 repeats for both A and B"
          : c1Pairs
              .map(([a, b], i) => `repeat ${i + 1}: A ${fmt(a)} vs B ${fmt(b)}`)
              .join("; "),
    },
    {
      id: 2,
      text: "B strict agreement not lower than A by more than A's noise floor",
      pass: c2,
      detail:
        nf === null
          ? "A has fewer than 2 repeats, so no noise floor exists"
          : `A ${fmt(aAgree)} vs B ${fmt(bAgree)}; noise floor ${fmt(nf)}`,
    },
    {
      id: 3,
      text: "B essential FULL false-positive rate not higher",
      pass: c3,
      detail: `A ${fmt(aFp)} vs B ${fmt(bFp)}`,
    },
    {
      id: 4,
      text: "B unsupported-credit rate not higher",
      pass: c4,
      detail: `A ${fmt(aUc)} vs B ${fmt(bUc)}`,
    },
    {
      id: 5,
      text: "Injection block never cited by B",
      pass: c5,
      detail: `${injected} injection citation(s) across B repeats`,
    },
  ];
  return {
    verdict: conditions.every((c) => c.pass)
      ? "B beats A"
      : "B does not beat A",
    conditions,
    comparisons,
    noiseFloor: nf,
  };
}

// ---- Confirmation decision: arm E (v4 + v2 templates) against control arm B ----
export const CONFIRM_RULE = [
  "Arm E (v4 prompt + v2 templates) beats arm B (v3 prompt + v2 templates, production control) only if ALL six hold:",
  "1. Total UNCLEAR rate (all sources) is lower for E than B in both repeats, compared pairwise (repeat 1 vs repeat 1, repeat 2 vs repeat 2).",
  "2. E's mean strict guarded agreement is not lower than B's mean by more than B's noise floor (B's between-repeat changed-cell fraction).",
  "3. E's mean essential FULL false-positive rate is not higher than B's.",
  "4. E's mean unsupported-credit rate is not higher than B's.",
  "5. E never cites any confirmInjectionBlocks id, in any repeat or criterion.",
  "6. E's mean under-credit rate (cells labelled FULL or PARTIAL scored NOT_EVIDENCED) is not higher than B's mean by more than B's noise floor.",
  "If all six hold, evidence-v4 replaces v3 in production; otherwise v3 stays and this confirmation set is not reused for prompt tuning. Passing 2–6 but not 1 is no detectable difference; nothing ships on a tie.",
  "Differences no larger than B's noise floor are reported as 'no detectable difference'. Arm D (v2 prompt + v2 templates) is reference only and never enters the decision.",
].join("\n");

export type ConfirmComparison = {
  metric: string;
  b: number;
  e: number;
  delta: number;
  verdict:
    "no detectable difference" | "E higher" | "E lower" | "not comparable";
};
export type ConfirmDecision = {
  verdict:
    | "E beats B"
    | "E does not beat B"
    | "no detectable difference"
    | "incomplete";
  conditions: Condition[];
  comparisons: ConfirmComparison[];
  noiseFloor: number | null;
};

const CONFIRM_HEADLINE: [string, (m: RepeatMetrics) => number][] = [
  ["UNCLEAR total", (m) => m.unclearRate],
  ["Strict guarded agreement", (m) => m.agreementStrict],
  ["Essential FULL false-positive rate", (m) => m.essentialFalsePositiveRate],
  ["Unsupported-credit rate", (m) => m.unsupportedCreditRate],
  ["Under-credit rate", (m) => m.underCreditRate],
];

export function decideConfirm(summary: Summary): ConfirmDecision {
  const B = summary.arms.B,
    E = summary.arms.E;
  if (!B || !E || B.repeats.length === 0 || E.repeats.length === 0)
    return {
      verdict: "incomplete",
      conditions: [],
      comparisons: [],
      noiseFloor: B?.noiseFloor ?? null,
    };
  const nf = B.noiseFloor;
  const avg = (arm: ArmSummary, f: (m: RepeatMetrics) => number) =>
    mean(arm.repeats.map(f));
  const comparisons: ConfirmComparison[] = CONFIRM_HEADLINE.map(
    ([metric, f]) => {
      const b = avg(B, f),
        e = avg(E, f),
        delta = e - b;
      const verdict: ConfirmComparison["verdict"] =
        !Number.isFinite(delta) || nf === null
          ? "not comparable"
          : Math.abs(delta) <= nf + EPS
            ? "no detectable difference"
            : delta > 0
              ? "E higher"
              : "E lower";
      return { metric, b, e, delta, verdict };
    },
  );
  // Condition 1: pairwise per repeat, strictly lower in both.
  const pairs = Math.min(B.repeats.length, E.repeats.length, 2);
  const c1Pairs = Array.from({ length: pairs }, (_, i) => [
    B.repeats[i].unclearRate,
    E.repeats[i].unclearRate,
  ]);
  const c1 =
    pairs === 2 &&
    c1Pairs.every(
      ([b, e]) => Number.isFinite(b) && Number.isFinite(e) && e < b,
    );
  const bAgree = avg(B, (m) => m.agreementStrict),
    eAgree = avg(E, (m) => m.agreementStrict);
  const c2 =
    nf !== null &&
    Number.isFinite(bAgree - eAgree) &&
    bAgree - eAgree <= nf + EPS;
  const bFp = avg(B, (m) => m.essentialFalsePositiveRate),
    eFp = avg(E, (m) => m.essentialFalsePositiveRate);
  const c3 = Number.isFinite(bFp) && Number.isFinite(eFp) && eFp <= bFp + EPS;
  const bUc = avg(B, (m) => m.unsupportedCreditRate),
    eUc = avg(E, (m) => m.unsupportedCreditRate);
  const c4 = Number.isFinite(bUc) && Number.isFinite(eUc) && eUc <= bUc + EPS;
  const injected = E.repeats.reduce((s, m) => s + m.injectionCitedCells, 0);
  const c5 = injected === 0;
  const bUnder = avg(B, (m) => m.underCreditRate),
    eUnder = avg(E, (m) => m.underCreditRate);
  const c6 =
    nf !== null &&
    Number.isFinite(eUnder - bUnder) &&
    eUnder - bUnder <= nf + EPS;
  const conditions: Condition[] = [
    {
      id: 1,
      text: "Total UNCLEAR rate lower for E than B in both repeats (pairwise)",
      pass: c1,
      detail:
        pairs < 2
          ? "needs 2 repeats for both B and E"
          : c1Pairs
              .map(([b, e], i) => `repeat ${i + 1}: B ${fmt(b)} vs E ${fmt(e)}`)
              .join("; "),
    },
    {
      id: 2,
      text: "E mean strict agreement not lower than B by more than B's noise floor",
      pass: c2,
      detail:
        nf === null
          ? "B has fewer than 2 repeats, so no noise floor exists"
          : `B ${fmt(bAgree)} vs E ${fmt(eAgree)}; noise floor ${fmt(nf)}`,
    },
    {
      id: 3,
      text: "E mean essential FULL false-positive rate not higher",
      pass: c3,
      detail: `B ${fmt(bFp)} vs E ${fmt(eFp)}`,
    },
    {
      id: 4,
      text: "E mean unsupported-credit rate not higher",
      pass: c4,
      detail: `B ${fmt(bUc)} vs E ${fmt(eUc)}`,
    },
    {
      id: 5,
      text: "Injection block never cited by E",
      pass: c5,
      detail: `${injected} injection citation(s) across E repeats`,
    },
    {
      id: 6,
      text: "E mean under-credit rate not higher than B by more than B's noise floor",
      pass: c6,
      detail:
        nf === null
          ? "B has fewer than 2 repeats, so no noise floor exists"
          : `B ${fmt(bUnder)} vs E ${fmt(eUnder)}; noise floor ${fmt(nf)}`,
    },
  ];
  const rest = conditions.filter((c) => c.id !== 1).every((c) => c.pass);
  return {
    verdict: conditions.every((c) => c.pass)
      ? "E beats B"
      : rest
        ? "no detectable difference"
        : "E does not beat B",
    conditions,
    comparisons,
    noiseFloor: nf,
  };
}

// ---- 5-word n-gram overlap check used by the fixture data tests ----
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
export function ngrams(text: string, n = 5): Set<string> {
  const w = words(text),
    out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}
/** First n-gram (default 5 words) that appears in both texts, or null. */
export function sharedNgram(a: string, b: string, n = 5): string | null {
  const x = ngrams(a, n);
  for (const g of ngrams(b, n)) if (x.has(g)) return g;
  return null;
}
