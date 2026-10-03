import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { EVIDENCE_SYSTEM, buildEvidencePrompt } from "../lib/pipeline/ai";
import {
  ALL_ARMS,
  ARMS,
  V2_SYSTEM,
  V3_SYSTEM,
  V4_SYSTEM,
  buildV2Prompt,
} from "../scripts/benchmark/criteria/arms";
import {
  CONFIRM_RULE,
  decide,
  decideConfirm,
  ngrams,
  PRE_REGISTERED_RULE,
  sharedNgram,
  summarise,
} from "../scripts/benchmark/criteria/metrics";
import { rubricFor } from "../scripts/benchmark/criteria/templates-v1";
import type {
  ArmId,
  Category,
  Label,
  Result,
  Role,
} from "../scripts/benchmark/criteria/types";
import type { Application } from "../lib/workflow";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ROLES: Role[] = [
  "customer-success",
  "accounts-assistant",
  "service-desk",
];

const app = {
  id: "app1",
  name: "Fictional Person",
  file: "x.docx",
  state: "ready",
  documentVersion: 1,
  runId: "r1",
  rubricVersion: 1,
  assessments: {},
  sourceChecked: false,
  confirmed: false,
  blocks: [
    {
      id: "b1",
      text: "raw one",
      assessmentText: "assessed one",
      locator: "Paragraph 1",
      documentVersion: 1,
    },
    { id: "b2", text: "raw two", locator: "Paragraph 2", documentVersion: 1 },
  ],
} as unknown as Application;

describe("arms", () => {
  it("pins the verbatim v2 system prompt from d37094f", () => {
    expect(sha(V2_SYSTEM)).toBe(
      "abbf3b55c67e2a8b91515a4a214e681325257fac190848ca8508942df472095a",
    );
  });
  it("pins the v4 system prompt used by arm E", () => {
    expect(sha(V4_SYSTEM)).toBe(
      "84b3335398dc52db4cd6e0eefd08639003acc0f06e4cbcb5348b56ac0bc6536b",
    );
    expect(V4_SYSTEM).not.toContain('"');
  });
  it("arm E is the v4 system over the production prompt and v2 templates", () => {
    const rubric = rubricFor(2, "accounts-assistant");
    const e = ALL_ARMS.find((a) => a.id === "E")!;
    expect(e.label).toBe("v4 + v2 templates");
    expect([e.promptVersion, e.templateVersion]).toEqual([4, 2]);
    const built = e.build(app, rubric, "Accounts assistant");
    expect(built.system).toBe(V4_SYSTEM);
    expect(built.prompt).toBe(
      buildEvidencePrompt(app, rubric, "Accounts assistant"),
    );
    expect(built.prompt).toBe(
      ARMS.find((a) => a.id === "B")!.build(app, rubric, "Accounts assistant")
        .prompt,
    );
    expect(ARMS.map((a) => a.id)).toEqual(["A", "B", "C", "D"]);
    expect(ALL_ARMS.map((a) => a.id)).toEqual(["A", "B", "C", "D", "E"]);
  });
  it("builds the v2 prompt with exactly the v2 keys", () => {
    const parsed = JSON.parse(buildV2Prompt(app, rubricFor(2, "service-desk")));
    expect(Object.keys(parsed).sort()).toEqual([
      "approvedCriteria",
      "untrustedSource",
    ]);
    for (const c of parsed.approvedCriteria)
      expect(Object.keys(c).sort()).toEqual(["full", "id", "partial", "title"]);
    expect(parsed.untrustedSource).toEqual([
      { id: "b1", text: "assessed one" },
      { id: "b2", text: "raw two" },
    ]);
  });
  it("arm B is the production prompt and system, with vacancy title, section and equivalents", () => {
    const rubric = rubricFor(2, "accounts-assistant");
    const b = ARMS.find((a) => a.id === "B")!.build(
      app,
      rubric,
      "Accounts assistant",
    );
    expect(b.system).toBe(V3_SYSTEM);
    expect(b.prompt).toBe(
      buildEvidencePrompt(app, rubric, "Accounts assistant"),
    );
    const parsed = JSON.parse(b.prompt);
    expect(parsed.vacancyTitle).toBe("Accounts assistant");
    expect(parsed.approvedCriteria[0]).toHaveProperty("section");
    expect(parsed.approvedCriteria[0]).toHaveProperty("equivalents");
  });
  it("describes arms A to D by prompt and template version", () => {
    expect(ARMS.map((a) => [a.id, a.promptVersion, a.templateVersion])).toEqual(
      [
        ["A", 2, 1],
        ["B", 3, 2],
        ["C", 3, 1],
        ["D", 2, 2],
      ],
    );
    const rubric = rubricFor(1, "service-desk");
    expect(ARMS[0].build(app, rubric, "x").system).toBe(V2_SYSTEM);
    expect(ARMS[2].build(app, rubric, "Service desk analyst").system).toBe(
      V3_SYSTEM,
    );
    expect(ARMS[3].build(app, rubric, "x").prompt).toBe(
      buildV2Prompt(app, rubric),
    );
  });
});

describe("rubricFor", () => {
  const rubricDigest = (version: 1 | 2, role: Role) =>
    sha(
      JSON.stringify(
        rubricFor(version, role).map((c) => [
          c.id,
          c.section,
          c.title,
          c.points,
          c.essential,
          c.full,
          c.partial,
          c.equivalents ?? "",
        ]),
      ),
    );
  const PINNED: Record<string, string> = {
    "1 customer-success":
      "6402aa47c9fb12a5566ffd81401c29e3723e1ec3ad70ad3f3a72fd76d40c5fe1",
    "1 accounts-assistant":
      "9bbc4e282cd92dd30991818554da40f05cca9a025816f9734bbdefc88a0b155c",
    "1 service-desk":
      "07386650a137f7f5b3d71a2e579bc050ef4249349370868b5cede1da9c5afdc2",
    "2 customer-success":
      "4ea1872b8a14207c80a7a1e82ca0ebc384e4f04d038e68935237408e1c7db744",
    "2 accounts-assistant":
      "417ecc71e0626ebb7f75545ca5fbfb95c2a49b0786e167e3b083aefff48cf88e",
    "2 service-desk":
      "2ba1ae26dcbaf165c10f421e7745d1cc16ab8db174b58e7b4625287b709c70a9",
  };
  it.each(ROLES)(
    "returns 4 v1 and 6 v2 criteria totalling 100 for %s",
    (role) => {
      const v1 = rubricFor(1, role),
        v2 = rubricFor(2, role);
      expect(v1).toHaveLength(4);
      expect(v2).toHaveLength(6);
      expect(v1.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
      expect(v2.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
      expect(v1.reduce((s, c) => s + c.points, 0)).toBe(100);
      expect(v2.reduce((s, c) => s + c.points, 0)).toBe(100);
      expect(v1.every((c) => c.equivalents === undefined)).toBe(true);
    },
  );
  it.each(
    ROLES.flatMap(
      (r) =>
        [
          [1, r],
          [2, r],
        ] as const,
    ),
  )("pins v%i criteria text for %s", (version, role) => {
    expect(
      rubricDigest(version, role),
      "A template changed: relabel the benchmark (labels.ts) before updating this digest",
    ).toBe(PINNED[`${version} ${role}`]);
  });
});

// ---------- metrics on hand-built results ----------
function cell(
  arm: ArmId,
  repeat: number,
  i: number,
  p1: Category | null,
  p2: Category | null,
  guarded: Category,
  extra: Partial<Result> = {},
): Result {
  return {
    arm,
    repeat,
    caseId: `k${i}`,
    rubricVersion: 2,
    criterionId: "c1",
    essential: false,
    pass1Category: p1,
    pass2Category: p2,
    pass1Evidence: [],
    pass2Evidence: [],
    guardedCategory: guarded,
    guardedEvidence: [],
    ...extra,
  };
}
const label = (
  i: number,
  expected: Category,
  extra: Partial<Label> = {},
): Label => ({
  caseId: `k${i}`,
  rubricVersion: 2,
  criterionId: "c1",
  expected,
  support: [],
  why: "test",
  debatable: false,
  ...extra,
});

describe("metrics", () => {
  it("splits UNCLEAR into disagreement, invalid-pass and model-asserted", () => {
    const labels = [0, 1, 2, 3].map((i) => label(i, "FULL"));
    const results = [
      cell("A", 1, 0, "FULL", "PARTIAL", "UNCLEAR"),
      cell("A", 1, 1, "FULL", null, "UNCLEAR"),
      cell("A", 1, 2, "UNCLEAR", "UNCLEAR", "UNCLEAR"),
      cell("A", 1, 3, "FULL", "FULL", "FULL"),
    ];
    const m = summarise(results, labels).arms.A!.repeats[0];
    expect(m.unclearFromDisagreement).toBe(0.25);
    expect(m.unclearFromInvalidPass).toBe(0.25);
    expect(m.unclearModelAsserted).toBe(0.25);
    expect(m.unclearRate).toBe(0.75);
    expect(m.disagreementRate).toBe(0.25);
    expect(m.validPassRate).toBe(7 / 8);
    expect(m.agreementStrict).toBe(0.25);
    expect(m.perPassAgreement.pass1.rate).toBe(0.75);
    expect(m.perPassAgreement.pass2.rate).toBeCloseTo(1 / 3);
    expect(m.confusion[0]).toEqual([1, 0, 0, 3]);
  });
  it("computes the three agreement variants", () => {
    const labels = [
      label(0, "FULL"),
      label(1, "PARTIAL", { debatable: true, alternative: "FULL" }),
      label(2, "PARTIAL", { debatable: true }),
      label(3, "NOT_EVIDENCED"),
    ];
    const results = [
      cell("A", 1, 0, "FULL", "FULL", "FULL"),
      cell("A", 1, 1, "FULL", "FULL", "FULL"),
      cell("A", 1, 2, "FULL", "FULL", "FULL"),
      cell("A", 1, 3, "NOT_EVIDENCED", "NOT_EVIDENCED", "NOT_EVIDENCED"),
    ];
    const m = summarise(results, labels).arms.A!.repeats[0];
    expect(m.agreementStrict).toBe(0.5);
    expect(m.agreementExcludingDebatable).toBe(1);
    expect(m.agreementAcceptEither).toBe(0.75);
  });
  it("counts essential FULL false positives and negatives on essential criteria only", () => {
    const labels = [0, 1, 2, 3, 4].map((i) =>
      label(i, i === 0 || i === 3 ? "FULL" : "PARTIAL"),
    );
    const results = [
      cell("A", 1, 0, "PARTIAL", "PARTIAL", "PARTIAL", { essential: true }), // FN
      cell("A", 1, 1, "FULL", "FULL", "FULL", { essential: true }), // FP
      cell("A", 1, 2, "FULL", "FULL", "FULL", { essential: false }), // ignored FP
      cell("A", 1, 3, "PARTIAL", "PARTIAL", "PARTIAL", { essential: false }), // ignored FN
      cell("A", 1, 4, "PARTIAL", "PARTIAL", "PARTIAL", { essential: true }), // correct
    ];
    const m = summarise(results, labels).arms.A!.repeats[0];
    expect(m.essentialCells).toBe(3);
    expect(m.essentialFalsePositives).toBe(1);
    expect(m.essentialFalseNegatives).toBe(1);
    expect(m.essentialFalsePositiveRate).toBeCloseTo(1 / 3);
  });
  it("scores evidence exact-set and superset matches, unsupported credit and injection citations", () => {
    const labels = [
      label(0, "FULL", { support: ["b1", "b2"] }),
      label(1, "FULL", { support: ["b1"] }),
      label(2, "PARTIAL", { support: ["b3"] }),
      label(3, "NOT_EVIDENCED"),
      label(4, "NOT_EVIDENCED"),
    ];
    const results = [
      cell("A", 1, 0, "FULL", "FULL", "FULL", {
        guardedEvidence: ["b2", "b1"],
      }), // exact
      cell("A", 1, 1, "FULL", "FULL", "FULL", {
        guardedEvidence: ["b1", "b4"],
      }), // superset
      cell("A", 1, 2, "PARTIAL", "PARTIAL", "PARTIAL", {
        guardedEvidence: ["b9"],
      }), // neither
      cell("A", 1, 3, "PARTIAL", "PARTIAL", "PARTIAL", {
        guardedEvidence: ["b5"],
        pass2Evidence: ["b7"],
      }), // unsupported; injected
      cell("A", 1, 4, "NOT_EVIDENCED", "NOT_EVIDENCED", "NOT_EVIDENCED"),
    ];
    const m = summarise(results, labels, { k3: ["b7"], k0: ["b99"] }).arms.A!
      .repeats[0];
    expect(m.evidenceExact).toBe(2 / 5);
    expect(m.evidenceExactFullPartial).toBe(1 / 3);
    expect(m.evidenceSuperset).toBe(2 / 3);
    expect(m.unsupportedCredit).toBe(1);
    expect(m.unsupportedCreditRate).toBe(0.5);
    expect(m.injectionCitedCells).toBe(1);
    expect(m.injectionCitedCases).toEqual(["k3"]);
  });
  it("measures the between-repeat noise floor only for arms with two repeats", () => {
    const labels = [0, 1, 2, 3].map((i) => label(i, "FULL"));
    const r1 = [0, 1, 2, 3].map((i) => cell("A", 1, i, "FULL", "FULL", "FULL"));
    const r2 = [
      cell("A", 2, 0, "FULL", "FULL", "FULL"),
      cell("A", 2, 1, "FULL", "PARTIAL", "UNCLEAR"),
      cell("A", 2, 2, "FULL", "FULL", "FULL"),
      cell("A", 2, 3, "PARTIAL", "PARTIAL", "PARTIAL"),
    ];
    const c = [0, 1, 2, 3].map((i) => cell("C", 1, i, "FULL", "FULL", "FULL"));
    const s = summarise([...r1, ...r2, ...c], labels);
    expect(s.arms.A!.noiseFloor).toBe(0.5);
    expect(s.arms.C!.noiseFloor).toBeNull();
  });
});

describe("decide", () => {
  const N = 10;
  const labels: Label[] = Array.from({ length: N }, (_, i) =>
    label(i, i < 2 ? "FULL" : i === 9 ? "NOT_EVIDENCED" : "PARTIAL"),
  );
  type Tweak = (arm: ArmId, repeat: number, i: number, base: Result) => Result;
  function scenario(tweak: Tweak = (_a, _r, _i, b) => b) {
    const out: Result[] = [];
    for (const arm of ["A", "B"] as const)
      for (const repeat of [1, 2])
        for (let i = 0; i < N; i++) {
          const expected = labels[i].expected;
          let base = cell(arm, repeat, i, expected, expected, expected, {
            essential: i < 2,
          });
          // A has one disagreement-driven UNCLEAR per repeat, on different cells.
          if (arm === "A" && i === repeat - 1)
            base = {
              ...base,
              pass2Category: "PARTIAL",
              guardedCategory: "UNCLEAR",
            };
          out.push(tweak(arm, repeat, i, base));
        }
    return out;
  }
  const run = (tweak?: Tweak, injection: Record<string, string[]> = {}) =>
    decide(summarise(scenario(tweak), labels, injection));
  const failed = (d: ReturnType<typeof decide>) =>
    d.conditions.filter((c) => !c.pass).map((c) => c.id);

  it("states the rule as a constant", () => {
    expect(PRE_REGISTERED_RULE).toContain("noise floor");
    expect(PRE_REGISTERED_RULE).toContain("no detectable difference");
  });
  it("passes when all five conditions hold", () => {
    const d = run();
    expect(d.noiseFloor).toBe(0.2);
    expect(failed(d)).toEqual([]);
    expect(d.verdict).toBe("B beats A");
  });
  it("fails condition 1 when B is not lower in both repeats", () => {
    const d = run((arm, repeat, i, b) =>
      arm === "B" && repeat === 2 && i === 5
        ? {
            ...b,
            pass1Category: "FULL",
            pass2Category: "PARTIAL",
            guardedCategory: "UNCLEAR",
          }
        : b,
    );
    expect(failed(d)).toContain(1);
    expect(d.verdict).toBe("B does not beat A");
  });
  it("fails condition 2 only when strict agreement drops by more than the noise floor", () => {
    const wrong =
      (n: number): Tweak =>
      (arm, _r, i, b) =>
        arm === "B" && i >= 2 && i < 2 + n
          ? {
              ...b,
              pass1Category: "NOT_EVIDENCED",
              pass2Category: "NOT_EVIDENCED",
              guardedCategory: "NOT_EVIDENCED",
            }
          : b;
    expect(failed(run(wrong(1)))).not.toContain(2);
    expect(failed(run(wrong(4)))).toContain(2);
  });
  it("fails condition 3 on more essential FULL false positives", () => {
    const d = run((arm, _r, i, b) =>
      arm === "B" && i === 3
        ? { ...b, essential: true, guardedCategory: "FULL" }
        : b,
    );
    expect(failed(d)).toEqual([3]);
  });
  it("fails condition 4 on more unsupported credit", () => {
    const d = run((arm, _r, i, b) =>
      arm === "B" && i === 9 ? { ...b, guardedCategory: "PARTIAL" } : b,
    );
    expect(failed(d)).toEqual([4]);
  });
  it("fails condition 5 when B cites the injection block", () => {
    const d = run(
      (arm, repeat, i, b) =>
        arm === "B" && repeat === 2 && i === 4
          ? { ...b, pass2Evidence: ["b9"] }
          : b,
      { k4: ["b9"] },
    );
    expect(failed(d)).toEqual([5]);
  });
  it("labels differences inside the noise floor as no detectable difference", () => {
    const d = run();
    const agree = d.comparisons.find(
      (c) => c.metric === "Strict guarded agreement",
    )!;
    expect(agree.verdict).toBe("no detectable difference");
    const unclear = d.comparisons.find(
      (c) => c.metric === "UNCLEAR from disagreement",
    )!;
    expect(unclear.verdict).toBe("no detectable difference");
  });
  it("is incomplete without both arms and fails condition 2 with a single A repeat", () => {
    expect(decide({ arms: {} }).verdict).toBe("incomplete");
    const only1 = scenario().filter((r) => !(r.arm === "A" && r.repeat === 2));
    const d = decide(summarise(only1, labels));
    expect(failed(d)).toContain(2);
    expect(d.verdict).toBe("B does not beat A");
  });
});

describe("underCreditRate", () => {
  it("counts FULL and PARTIAL labelled cells scored NOT_EVIDENCED", () => {
    const labels = [
      label(0, "FULL"),
      label(1, "PARTIAL"),
      label(2, "PARTIAL"),
      label(3, "NOT_EVIDENCED"),
      label(4, "FULL"),
      label(5, "UNCLEAR"),
    ];
    const results = [
      cell("B", 1, 0, "NOT_EVIDENCED", "NOT_EVIDENCED", "NOT_EVIDENCED"),
      cell("B", 1, 1, "NOT_EVIDENCED", "NOT_EVIDENCED", "NOT_EVIDENCED"),
      cell("B", 1, 2, "PARTIAL", "PARTIAL", "PARTIAL"),
      cell("B", 1, 3, "PARTIAL", "PARTIAL", "PARTIAL"), // over-credit, not under-credit
      cell("B", 1, 4, "FULL", "FULL", "FULL"),
      cell("B", 1, 5, "NOT_EVIDENCED", "NOT_EVIDENCED", "NOT_EVIDENCED"), // UNCLEAR label, ignored
    ];
    const m = summarise(results, labels).arms.B!.repeats[0];
    expect(m.underCredit).toBe(2);
    expect(m.underCreditRate).toBe(2 / 4);
  });
  it("is not a number when no cell is labelled FULL or PARTIAL", () => {
    const m = summarise(
      [cell("B", 1, 0, "FULL", "FULL", "FULL")],
      [label(0, "NOT_EVIDENCED")],
    ).arms.B!.repeats[0];
    expect(Number.isNaN(m.underCreditRate)).toBe(true);
  });
});

describe("generic noise floor", () => {
  it("is the changed-cell fraction for every arm with two repeats, null otherwise", () => {
    const labels = [0, 1, 2, 3].map((i) => label(i, "FULL"));
    const fill = (arm: ArmId, repeat: number, changed: number) =>
      [0, 1, 2, 3].map((i) =>
        i < changed
          ? cell(arm, repeat, i, "FULL", "PARTIAL", "UNCLEAR")
          : cell(arm, repeat, i, "FULL", "FULL", "FULL"),
      );
    const s = summarise(
      [
        ...fill("B", 1, 0),
        ...fill("B", 2, 1),
        ...fill("E", 1, 0),
        ...fill("E", 2, 3),
        ...fill("D", 1, 0),
      ],
      labels,
    );
    expect(s.arms.B!.noiseFloor).toBe(0.25);
    expect(s.arms.E!.noiseFloor).toBe(0.75);
    expect(s.arms.D!.noiseFloor).toBeNull();
  });
});

describe("decideConfirm", () => {
  const N = 10;
  const labels: Label[] = Array.from({ length: N }, (_, i) =>
    label(i, i < 2 ? "FULL" : i === 9 ? "NOT_EVIDENCED" : "PARTIAL"),
  );
  type Tweak = (arm: ArmId, repeat: number, i: number, base: Result) => Result;
  function scenario(tweak: Tweak = (_a, _r, _i, b) => b) {
    const out: Result[] = [];
    for (const arm of ["B", "E"] as const)
      for (const repeat of [1, 2])
        for (let i = 0; i < N; i++) {
          const expected = labels[i].expected;
          let base = cell(arm, repeat, i, expected, expected, expected, {
            essential: i < 2,
          });
          // Control B has one disagreement-driven UNCLEAR per repeat, on different cells.
          if (arm === "B" && i === repeat - 1)
            base = {
              ...base,
              pass2Category: "PARTIAL",
              guardedCategory: "UNCLEAR",
            };
          out.push(tweak(arm, repeat, i, base));
        }
    return out;
  }
  const run = (tweak?: Tweak, injection: Record<string, string[]> = {}) =>
    decideConfirm(summarise(scenario(tweak), labels, injection));
  const failed = (d: ReturnType<typeof decideConfirm>) =>
    d.conditions.filter((c) => !c.pass).map((c) => c.id);
  const guard =
    (ids: number[], category: Category): Tweak =>
    (arm, _r, i, b) =>
      arm === "E" && ids.includes(i)
        ? {
            ...b,
            pass1Category: category,
            pass2Category: category,
            guardedCategory: category,
          }
        : b;

  it("states the rule and the ship statement as a constant", () => {
    expect(CONFIRM_RULE).toContain("ALL six hold");
    expect(CONFIRM_RULE).toContain("no detectable difference");
    expect(CONFIRM_RULE).toContain("reference only");
    expect(CONFIRM_RULE).toContain(
      "If all six hold, evidence-v4 replaces v3 in production; otherwise v3 stays and this confirmation set is not reused for prompt tuning. Passing 2–6 but not 1 is no detectable difference; nothing ships on a tie.",
    );
  });
  it("passes when all six conditions hold", () => {
    const d = run();
    expect(d.noiseFloor).toBe(0.2);
    expect(failed(d)).toEqual([]);
    expect(d.conditions).toHaveLength(6);
    expect(d.verdict).toBe("E beats B");
  });
  it("fails condition 1 and reports a tie when E is not lower than B in both repeats", () => {
    const d = run((arm, repeat, i, b) =>
      arm === "E" && repeat === 2 && i === 5
        ? {
            ...b,
            pass1Category: "UNCLEAR",
            pass2Category: "UNCLEAR",
            guardedCategory: "UNCLEAR",
          }
        : b,
    );
    expect(failed(d)).toEqual([1]);
    expect(d.verdict).toBe("no detectable difference");
  });
  it("counts model-asserted UNCLEAR in condition 1 (all sources)", () => {
    const d = run(guard([5], "UNCLEAR"));
    expect(failed(d)).toContain(1);
  });
  it("is not a tie when condition 1 fails together with another condition", () => {
    const d = run((arm, _r, i, b) =>
      arm === "E" && i === 9
        ? { ...b, pass1Category: "UNCLEAR", guardedCategory: "PARTIAL" }
        : arm === "E" && i === 5
          ? { ...b, guardedCategory: "UNCLEAR" }
          : b,
    );
    expect(failed(d)).toContain(1);
    expect(failed(d)).toContain(4);
    expect(d.verdict).toBe("E does not beat B");
  });
  it("fails condition 2 only when strict agreement drops by more than B's noise floor", () => {
    expect(failed(run(guard([2, 3, 4], "FULL")))).toEqual([]);
    expect(failed(run(guard([2, 3, 4, 5], "FULL")))).toEqual([2]);
  });
  it("fails condition 3 on more essential FULL false positives", () => {
    const d = run((arm, _r, i, b) =>
      arm === "E" && i === 3
        ? { ...b, essential: true, guardedCategory: "FULL" }
        : b,
    );
    expect(failed(d)).toEqual([3]);
    expect(d.verdict).toBe("E does not beat B");
  });
  it("fails condition 4 on more unsupported credit", () => {
    const d = run((arm, _r, i, b) =>
      arm === "E" && i === 9 ? { ...b, guardedCategory: "PARTIAL" } : b,
    );
    expect(failed(d)).toEqual([4]);
  });
  it("fails condition 5 when E cites an injection block in any repeat", () => {
    const d = run(
      (arm, repeat, i, b) =>
        arm === "E" && repeat === 2 && i === 4
          ? { ...b, pass2Evidence: ["b9"] }
          : b,
      { k4: ["b9"] },
    );
    expect(failed(d)).toEqual([5]);
    expect(d.verdict).toBe("E does not beat B");
  });
  it("ignores injection citations made by B", () => {
    const d = run(
      (arm, _r, i, b) =>
        arm === "B" && i === 4 ? { ...b, pass1Evidence: ["b9"] } : b,
      { k4: ["b9"] },
    );
    expect(failed(d)).toEqual([]);
  });
  it("fails condition 6 only when under-credit exceeds B's by more than B's noise floor", () => {
    // 1 of 9 creditable cells (11.1 pts) is inside the 20 pt noise floor; 3 of 9 (33.3 pts) is not.
    expect(failed(run(guard([5], "NOT_EVIDENCED")))).toEqual([]);
    const d = run(guard([5, 6, 7], "NOT_EVIDENCED"));
    expect(failed(d)).toEqual([6]);
    expect(d.verdict).toBe("E does not beat B");
  });
  it("labels differences inside B's noise floor as no detectable difference", () => {
    const d = run(guard([5], "NOT_EVIDENCED"));
    const under = d.comparisons.find((c) => c.metric === "Under-credit rate")!;
    expect(under.verdict).toBe("no detectable difference");
    const big = run(guard([5, 6, 7], "NOT_EVIDENCED")).comparisons.find(
      (c) => c.metric === "Under-credit rate",
    )!;
    expect(big.verdict).toBe("E higher");
  });
  it("is incomplete without both arms and fails 1, 2 and 6 with a single B repeat", () => {
    expect(decideConfirm({ arms: {} }).verdict).toBe("incomplete");
    const noE = scenario().filter((r) => r.arm === "B");
    expect(decideConfirm(summarise(noE, labels)).verdict).toBe("incomplete");
    const only1 = scenario().filter((r) => !(r.arm === "B" && r.repeat === 2));
    const d = decideConfirm(summarise(only1, labels));
    expect(failed(d)).toEqual(expect.arrayContaining([1, 2, 6]));
    expect(d.verdict).toBe("E does not beat B");
  });
  it("never lets arm D enter the decision", () => {
    const withD = [
      ...scenario(),
      ...Array.from({ length: N }, (_, i) =>
        cell("D", 1, i, "FULL", "FULL", "FULL", { essential: i < 2 }),
      ),
    ];
    expect(decideConfirm(summarise(withD, labels)).verdict).toBe("E beats B");
  });
});

describe("ngram helpers", () => {
  it("finds a shared five-word sequence ignoring case and punctuation", () => {
    expect(
      sharedNgram(
        "Ran the monthly renewal reviews, daily.",
        "He RAN the monthly renewal reviews",
      ),
    ).toBe("ran the monthly renewal reviews");
    expect(
      sharedNgram("one two three four", "one two three four five"),
    ).toBeNull();
    expect(ngrams("a b c d e f").size).toBe(2);
  });
});

describe("production evidence prompt", () => {
  it("is the confirmed v4 text and v3 stays frozen for the benchmark", () => {
    expect(EVIDENCE_SYSTEM).toBe(V4_SYSTEM);
    expect(createHash("sha256").update(V3_SYSTEM).digest("hex")).toBe(
      "c7f9e0863434206efe22b75ac8fb4643786424d0939726aed9d504619ccd21a3",
    );
  });
});
