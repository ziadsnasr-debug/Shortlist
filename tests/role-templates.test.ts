import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES, instantiateRoleTemplate } from "@/lib/role-templates";
import { isComplete, totalPoints } from "@/components/workflow/criteria/model";

describe("role templates", () => {
  it("keeps every built-in preset valid and within the rubric limit", () => {
    for (const template of ROLE_TEMPLATES) {
      const rubric = instantiateRoleTemplate(template.id, (() => {
        let i = 0;
        return () => `fresh-${++i}`;
      })());
      expect(rubric.length).toBeLessThanOrEqual(12);
      expect(totalPoints(rubric)).toBe(100);
      expect(rubric.every(isComplete)).toBe(true);
      expect(new Set(rubric.map((criterion) => criterion.id)).size).toBe(rubric.length);
      expect(rubric.some((criterion) => criterion.essential)).toBe(true);
    }
  });

  it("creates fresh IDs on every load without mutating the catalogue", () => {
    const first = instantiateRoleTemplate("service-desk", (() => {
      let i = 0;
      return () => `a-${++i}`;
    })());
    const second = instantiateRoleTemplate("service-desk", (() => {
      let i = 0;
      return () => `b-${++i}`;
    })());
    expect(first.map((criterion) => criterion.id)).not.toEqual(
      second.map((criterion) => criterion.id),
    );
    first[0].title = "Edited locally";
    expect(ROLE_TEMPLATES.find((template) => template.id === "service-desk")!.criteria[0].title).not.toBe("Edited locally");
  });
});
