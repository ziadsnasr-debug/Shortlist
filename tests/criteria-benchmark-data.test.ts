// Needs scripts/benchmark/criteria/fixtures.ts and labels.ts, which are written separately.
import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES } from "../lib/role-templates";
import {
  criteriaCases,
  injectionBlocks,
} from "../scripts/benchmark/criteria/fixtures";
import { criteriaLabels } from "../scripts/benchmark/criteria/labels";
import { sharedNgram } from "../scripts/benchmark/criteria/metrics";
import {
  TEMPLATES_V1,
  rubricFor,
} from "../scripts/benchmark/criteria/templates-v1";
import type { Role } from "../scripts/benchmark/criteria/types";

const ROLES: Role[] = [
  "customer-success",
  "accounts-assistant",
  "service-desk",
];
const PROFILES = [
  "direct",
  "assistant",
  "equivalent",
  "adversarial",
  "borderline",
];
const byId = new Map(criteriaCases.map((c) => [c.id, c]));

describe("criteria fixtures", () => {
  it("has unique cases that cover every role and profile", () => {
    expect(criteriaCases.length).toBeGreaterThan(0);
    expect(byId.size).toBe(criteriaCases.length);
    for (const role of ROLES)
      expect(
        criteriaCases.some((c) => c.role === role),
        role,
      ).toBe(true);
    for (const profile of PROFILES)
      expect(
        criteriaCases.some((c) => c.profile === profile),
        profile,
      ).toBe(true);
  });
  it.each(criteriaCases.map((c) => [c.id, c] as const))(
    "%s has well-formed fictional blocks",
    (_id, c) => {
      expect(c.brief.length).toBeGreaterThan(0);
      expect(c.app.documentVersion).toBe(1);
      expect(c.app.blocks.length).toBeGreaterThan(0);
      c.app.blocks.forEach((b, i) => {
        expect(b.id).toBe(`b${i + 1}`);
        expect(b.documentVersion).toBe(1);
        expect(b.locator).toBe(`Paragraph ${i + 1}`);
        expect(b.text.length).toBeGreaterThan(0);
        expect(b.assessmentText?.length ?? 0).toBeGreaterThan(0);
      });
    },
  );
  it("references only existing cases and blocks in injectionBlocks", () => {
    for (const [caseId, ids] of Object.entries(injectionBlocks)) {
      const c = byId.get(caseId);
      expect(c, caseId).toBeDefined();
      for (const id of ids)
        expect(
          c!.app.blocks.some((b) => b.id === id),
          `${caseId}/${id}`,
        ).toBe(true);
    }
  });
  it("shares no five-word sequence with any template Full, Partial or equivalents text", () => {
    const templateTexts = [
      ...ROLE_TEMPLATES.flatMap((t) =>
        t.criteria.flatMap((c) => [c.full, c.partial, c.equivalents ?? ""]),
      ),
      ...Object.values(TEMPLATES_V1).flatMap((list) =>
        list.flatMap((c) => [c.full, c.partial]),
      ),
    ].filter(Boolean);
    const offences: string[] = [];
    for (const c of criteriaCases)
      for (const b of c.app.blocks)
        for (const text of [b.text, b.assessmentText ?? ""])
          for (const t of templateTexts) {
            const gram = sharedNgram(text, t);
            if (gram) offences.push(`${c.id}/${b.id}: "${gram}"`);
          }
    expect(offences).toEqual([]);
  });
});

describe("criteria labels", () => {
  it("covers every case x rubric version x criterion exactly once", () => {
    const seen = new Map<string, number>();
    for (const l of criteriaLabels) {
      const key = `${l.caseId}|${l.rubricVersion}|${l.criterionId}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const expected: string[] = [];
    for (const c of criteriaCases)
      for (const version of [1, 2] as const)
        for (const crit of rubricFor(version, c.role))
          expected.push(`${c.id}|${version}|${crit.id}`);
    expect([...seen.keys()].sort()).toEqual(expected.sort());
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
  });
  it("uses valid ids and categories, supports and alternatives", () => {
    for (const l of criteriaLabels) {
      const tag = `${l.caseId} v${l.rubricVersion} ${l.criterionId}`;
      const c = byId.get(l.caseId);
      expect(c, tag).toBeDefined();
      expect([1, 2]).toContain(l.rubricVersion);
      expect(
        rubricFor(l.rubricVersion, c!.role).some((r) => r.id === l.criterionId),
        tag,
      ).toBe(true);
      expect(l.why.trim().length, tag).toBeGreaterThan(0);
      expect(new Set(l.support).size, tag).toBe(l.support.length);
      for (const id of l.support)
        expect(
          c!.app.blocks.some((b) => b.id === id),
          `${tag} support ${id}`,
        ).toBe(true);
      if (l.expected === "FULL" || l.expected === "PARTIAL")
        expect(l.support.length, `${tag} needs support`).toBeGreaterThan(0);
      if (l.expected === "NOT_EVIDENCED")
        expect(l.support, `${tag} must cite nothing`).toEqual([]);
      if (l.alternative) {
        expect(l.debatable, `${tag} alternative needs debatable`).toBe(true);
        expect(l.alternative, tag).not.toBe(l.expected);
      }
    }
  });
});
