// Needs scripts/benchmark/criteria/fixtures-confirm.ts and labels-confirm.ts.
import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES } from "../lib/role-templates";
import {
  confirmCases,
  confirmInjectionBlocks,
} from "../scripts/benchmark/criteria/fixtures-confirm";
import { confirmLabels } from "../scripts/benchmark/criteria/labels-confirm";
import { sharedNgram } from "../scripts/benchmark/criteria/metrics";
import {
  TEMPLATES_V1,
  rubricFor,
} from "../scripts/benchmark/criteria/templates-v1";

const byId = new Map(confirmCases.map((c) => [c.id, c]));
const GENDERED = /\b(she|he|her|his|him)\b/i;

describe("confirmation fixtures", () => {
  it("has 15 cases with unique ids", () => {
    expect(confirmCases).toHaveLength(15);
    expect(byId.size).toBe(15);
  });
  it.each(confirmCases.map((c) => [c.id, c] as const))(
    "%s has well-formed, gender-neutral fictional blocks",
    (_id, c) => {
      expect(c.brief.length).toBeGreaterThan(0);
      expect(c.brief).not.toMatch(GENDERED);
      expect(c.app.documentVersion).toBe(1);
      expect(c.app.blocks.length).toBeGreaterThan(0);
      c.app.blocks.forEach((b, i) => {
        expect(b.id).toBe(`b${i + 1}`);
        expect(b.documentVersion).toBe(1);
        expect(b.locator).toBe(`Paragraph ${i + 1}`);
        expect(b.text.length).toBeGreaterThan(0);
        expect(b.assessmentText?.length ?? 0).toBeGreaterThan(0);
        expect(b.text, `${c.id}/${b.id}`).not.toMatch(GENDERED);
        expect(b.assessmentText ?? "", `${c.id}/${b.id}`).not.toMatch(GENDERED);
      });
    },
  );
  it("references only existing cases and blocks in confirmInjectionBlocks", () => {
    for (const [caseId, ids] of Object.entries(confirmInjectionBlocks)) {
      const c = byId.get(caseId);
      expect(c, caseId).toBeDefined();
      for (const id of ids)
        expect(
          c!.app.blocks.some((b) => b.id === id),
          `${caseId}/${id}`,
        ).toBe(true);
    }
  });
  it("shares no five-word sequence with any v1 or v2 Full, Partial or equivalents text", () => {
    const templateTexts = [
      ...ROLE_TEMPLATES.flatMap((t) =>
        t.criteria.flatMap((c) => [c.full, c.partial, c.equivalents ?? ""]),
      ),
      ...Object.values(TEMPLATES_V1).flatMap((list) =>
        list.flatMap((c) => [c.full, c.partial]),
      ),
    ].filter(Boolean);
    const offences: string[] = [];
    for (const c of confirmCases)
      for (const b of c.app.blocks)
        for (const text of [b.text, b.assessmentText ?? ""])
          for (const t of templateTexts) {
            const gram = sharedNgram(text, t);
            if (gram) offences.push(`${c.id}/${b.id}: "${gram}"`);
          }
    expect(offences).toEqual([]);
  });
});

describe("confirmation labels", () => {
  it("has 90 labels covering every case x v2 criterion exactly once", () => {
    expect(confirmLabels).toHaveLength(90);
    expect(confirmLabels.every((l) => l.rubricVersion === 2)).toBe(true);
    const seen = new Map<string, number>();
    for (const l of confirmLabels) {
      const key = `${l.caseId}|${l.rubricVersion}|${l.criterionId}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const expected: string[] = [];
    for (const c of confirmCases)
      for (const crit of rubricFor(2, c.role))
        expected.push(`${c.id}|2|${crit.id}`);
    expect([...seen.keys()].sort()).toEqual(expected.sort());
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
  });
  it("uses valid ids, categories and supports", () => {
    for (const l of confirmLabels) {
      const tag = `${l.caseId} ${l.criterionId}`;
      const c = byId.get(l.caseId);
      expect(c, tag).toBeDefined();
      expect(
        rubricFor(2, c!.role).some((r) => r.id === l.criterionId),
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
  it("never cites an injection block as support", () => {
    for (const l of confirmLabels)
      expect(
        l.support.filter((id) =>
          (confirmInjectionBlocks[l.caseId] ?? []).includes(id),
        ),
        `${l.caseId} ${l.criterionId}`,
      ).toEqual([]);
  });
});
