import { describe, expect, it } from "vitest";
import { lintCriterion, lintRubric } from "@/lib/criteria-lint";
import { totalPoints } from "@/components/workflow/criteria/model";
import { balance } from "@/lib/points";
import { ROLE_TEMPLATES, instantiateRoleTemplate } from "@/lib/role-templates";
import { sampleRubric } from "@/fixtures/synthetic/seed";
import type { Criterion } from "@/lib/rules";

const base: Criterion = {
  id: "a",
  section: "Skills",
  title: "Customer onboarding",
  points: 20,
  essential: false,
  full: "Led onboarding sessions for new customers.",
  partial: "Joined onboarding sessions run by someone else.",
};
const make = (patch: Partial<Criterion>): Criterion => ({ ...base, ...patch });
const codes = (c: Criterion, rubric: Criterion[] = [c]) =>
  lintCriterion(c, rubric).map((h) => h.code);

describe("lintCriterion", () => {
  it("stays quiet on a clean criterion and on a blank title", () => {
    expect(codes(base)).toEqual([]);
    expect(codes(make({ title: "  ", full: "Strong", partial: "Strong" }))).toEqual(
      [],
    );
  });

  it("flags compound titles but not words that contain 'and'", () => {
    expect(codes(make({ title: "Reporting and insight" }))).toContain("compound");
    expect(codes(make({ title: "Sales & marketing" }))).toContain("compound");
    expect(codes(make({ title: "Billing/collections" }))).toContain("compound");
    expect(codes(make({ title: "Standards" }))).not.toContain("compound");
    expect(codes(make({ title: "Brand management" }))).not.toContain("compound");
  });

  it("lets fixed phrases through the compound check", () => {
    for (const title of [
      "Health and safety",
      "profit and loss accounts",
      "Research and Development",
      "Terms and conditions",
      "Learning and development",
      "A/B testing",
      "Email and/or phone support",
    ])
      expect(codes(make({ title }))).not.toContain("compound");
    expect(codes(make({ title: "Health and safety and compliance" }))).toContain(
      "compound",
    );
  });

  it("flags vague words once, as whole words, and quotes the match", () => {
    const hints = lintCriterion(
      make({ full: "Strong record. Excellent results." }),
      [base],
    ).filter((h) => h.code === "vague");
    expect(hints).toHaveLength(1);
    expect(hints[0].message).toBe(
      "“strong” is open to interpretation. Name what the CV would show instead.",
    );
    expect(codes(make({ title: "Sale of goods" }))).not.toContain("vague");
    expect(codes(make({ partial: "Clearly owned the account." }))).toContain("vague");
  });

  it("flags proxies and prefers the longest phrase", () => {
    const hints = lintCriterion(make({ full: "A native speaker of English." }), [
      base,
    ]).filter((h) => h.code === "proxy");
    expect(hints).toHaveLength(1);
    expect(hints[0].message).toBe(
      "“native speaker” can exclude equivalent experience. Describe the skill or outcome instead.",
    );
    for (const text of [
      "5+ years in sales",
      "3 years",
      "2 yrs of support",
      "Holds a degree",
      "Russell Group university",
      "Culture fit",
      "Career gaps",
      "Digital native",
      "Passionate about customers",
      "Applicants aged over 40",
      "Native English",
      "Top university",
      "Young and energetic",
    ])
      expect(codes(make({ full: text }))).toContain("proxy");
    for (const text of [
      "Managed a team",
      "Leads a managed service",
      "Gradual improvement",
      "Over several years of delivery",
      "React Native",
      "cloud-native",
      "Age UK",
      "5-11 age group",
      "a high degree of accuracy",
      "working with young people",
      "university hospital",
    ])
      expect(codes(make({ full: text }))).not.toContain("proxy");
  });

  it("flags full and partial that read almost the same", () => {
    expect(
      codes(
        make({
          full: "Leads onboarding sessions for new customers",
          partial: "Leads the onboarding sessions for the new customers.",
        }),
      ),
    ).toContain("overlap");
    expect(codes(base)).not.toContain("overlap");
  });

  it("keeps numbers when comparing full and partial", () => {
    expect(
      codes(
        make({
          full: "Resolved 50+ tickets a week",
          partial: "Resolved 10-49 tickets a week",
        }),
      ),
    ).not.toContain("overlap");
  });

  it("flags a duplicate title in another criterion only", () => {
    const other = make({ id: "b", title: "  customer   ONBOARDING " });
    expect(codes(base, [base, other])).toContain("duplicate");
    expect(codes(base, [base])).not.toContain("duplicate");
    expect(codes(base, [base, make({ id: "b", title: "Retention" })])).not.toContain(
      "duplicate",
    );
  });

  it("flags essential criteria worth under five points", () => {
    expect(codes(make({ essential: true, points: 4 }))).toContain(
      "essential-points",
    );
    expect(codes(make({ essential: true, points: 5 }))).not.toContain(
      "essential-points",
    );
    expect(codes(make({ essential: false, points: 1 }))).not.toContain(
      "essential-points",
    );
  });

  it("raises nothing on the shipped templates and only a compound hint on the sample", () => {
    for (const template of ROLE_TEMPLATES) {
      const rubric = instantiateRoleTemplate(template.id);
      for (const c of rubric) expect(lintCriterion(c, rubric)).toEqual([]);
    }
    const hinted = sampleRubric.flatMap((c) =>
      lintCriterion(c, sampleRubric).map((hint) => `${c.id}:${hint.code}`),
    );
    expect(hinted).toEqual(["c3:compound"]);
  });
});

describe("lintRubric", () => {
  it("says nothing for an empty rubric and for six to eight criteria", () => {
    expect(lintRubric([])).toEqual([]);
    expect(lintRubric(sampleRubric)).toEqual([]);
  });

  it("flags too few criteria, and the role templates no longer do", () => {
    for (const t of ROLE_TEMPLATES)
      expect(lintRubric(instantiateRoleTemplate(t.id))).toEqual([]);
    expect(lintRubric(sampleRubric.slice(0, 5))[0].message).toMatch(
      /^Fewer than six/,
    );
  });

  it("flags more than eight criteria", () => {
    const many = Array.from({ length: 9 }, (_, i) => make({ id: `c${i}` }));
    expect(lintRubric(many)[0].message).toMatch(/^More than eight/);
  });

  it("flags when most criteria are essential", () => {
    const rubric = Array.from({ length: 6 }, (_, i) =>
      make({ id: `c${i}`, essential: i < 4 }),
    );
    expect(lintRubric(rubric).map((h) => h.code)).toEqual(["essentials"]);
    expect(
      lintRubric(rubric.map((c, i) => ({ ...c, essential: i < 3 }))),
    ).toEqual([]);
  });
});

describe("balance", () => {
  const rubric = (points: number[]) =>
    points.map((p, i) => make({ id: `c${i}`, points: p }));
  const pointsOf = (r: Criterion[]) => r.map((c) => c.points);

  it("splits remainders to the earliest equal weights", () => {
    expect(pointsOf(balance(rubric([10, 10, 10])))).toEqual([34, 33, 33]);
  });

  it("keeps twelve one-point criteria at or above one and totals 100", () => {
    const result = balance(rubric(Array(12).fill(1)));
    expect(totalPoints(result)).toBe(100);
    expect(result.every((c) => c.points >= 1)).toBe(true);
  });

  it("leaves a rubric that already totals 100 alone", () => {
    expect(pointsOf(balance(sampleRubric))).toEqual(pointsOf(sampleRubric));
  });

  it("splits equally when the total is zero", () => {
    expect(pointsOf(balance(rubric([0, 0, 0, 0])))).toEqual([25, 25, 25, 25]);
  });

  it("rounds [99, 99] to [50, 50]", () => {
    expect(pointsOf(balance(rubric([99, 99])))).toEqual([50, 50]);
  });

  it("holds the one-point floor when a small weight would round to zero", () => {
    const result = balance(rubric([100, 100, 1]));
    expect(pointsOf(result)).toEqual([50, 49, 1]);
    const skewed = balance(rubric([100, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]));
    expect(totalPoints(skewed)).toBe(100);
    expect(skewed.every((c) => c.points >= 1)).toBe(true);
  });

  it("returns [], preserves order and other fields, and does not mutate", () => {
    expect(balance([])).toEqual([]);
    const input = rubric([30, 30]);
    const result = balance(input);
    expect(result.map((c) => c.id)).toEqual(["c0", "c1"]);
    expect(result[0].title).toBe(input[0].title);
    expect(input[0].points).toBe(30);
  });
});
