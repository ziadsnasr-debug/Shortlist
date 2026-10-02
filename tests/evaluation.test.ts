import { it, expect } from "vitest";
import { evaluate, repeatability, timedComparison } from "../lib/evaluation";
import {
  evaluationFixtures,
  adversarialPairs,
} from "../fixtures/synthetic/evaluation";
it("has disjoint 15 development and 30 held-out fixtures plus 20 pairs", () => {
  expect(evaluationFixtures).toHaveLength(45);
  expect(evaluationFixtures.filter((f) => f.split === "held-out")).toHaveLength(
    30,
  );
  expect(new Set(evaluationFixtures.map((f) => f.id)).size).toBe(45);
  expect(adversarialPairs).toHaveLength(20);
});
it("keeps errors and unresolved responses in denominator", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    fixtureId: "cv" + i,
    role: "role",
    criterionId: "c1",
    expected: "FULL",
    actual: i < 8 ? "FULL" : null,
    validSupport: true,
    essential: false,
    essentialReviewed: false,
    humanLabelledBy: "Independent fixture reviewer",
    independentOfModel: true,
  }));
  const result = evaluate(rows);
  expect(result.agreement).toBe(0.8);
  expect(result.invalidOrMissing).toBe(2);
  expect(result.proposedQualityThresholdsMet).toBe(false);
});
it("requires independent labels and rejects duplicate observations", () => {
  expect(() =>
    evaluate([
      {
        fixtureId: "cv",
        role: "r",
        criterionId: "c",
        expected: "FULL",
        actual: "FULL",
        validSupport: true,
        essential: false,
        essentialReviewed: true,
        humanLabelledBy: "",
        independentOfModel: false,
      },
    ]),
  ).toThrow();
});
it("blocks unsupported credit and unreviewed essential cases despite exact categories", () => {
  const report = evaluate([
    {
      fixtureId: "cv",
      role: "r",
      criterionId: "c",
      expected: "FULL",
      actual: "FULL",
      validSupport: false,
      essential: true,
      essentialReviewed: false,
      humanLabelledBy: "Reviewer",
      independentOfModel: true,
    },
  ]);
  expect(report.unsupported).toBe(1);
  expect(report.proposedQualityThresholdsMet).toBe(false);
});
it("reports actual variation and refuses fabricated incomplete timings", () => {
  expect(
    repeatability([
      ["FULL", "PARTIAL"],
      ["FULL", "FULL"],
      ["FULL", "PARTIAL"],
    ]).changed,
  ).toBe(1);
  expect(() => timedComparison([100], [50])).toThrow();
  expect(
    timedComparison([100, 100, 100], [70, 80, 60]).map((x) => x.targetMet),
  ).toEqual([true, false, true]);
});
