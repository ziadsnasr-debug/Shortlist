import { it, expect } from "vitest";
import { seed, samples } from "../fixtures/synthetic/seed";
import { recordId, reapplyDeletions } from "../lib/recovery";
it("reapplies current deletions to old state and snapshot without resurrecting CV content", () => {
  const s = seed(),
    b = s.vacancies[0].batches[0];
  b.applications = samples(b.rubric, b.rubricVersion);
  const original = b.applications[0];
  b.selected = [original.id];
  b.snapshot = {
    at: "fixture",
    actor: "admin",
    reason: "mentions name",
    tieReason: "mentions name",
    exceptions: { [original.id]: "personal reason" },
    selected: [original.id],
    rubricVersion: 1,
    rubric: b.rubric,
    applications: [
      {
        id: original.id,
        score: 100,
        assessments: original.assessments,
        blocks: original.blocks,
        documentVersion: 1,
        runId: original.runId,
      },
    ],
  };
  const result = reapplyDeletions(
    s,
    "workspace",
    new Set([recordId("workspace", original.id)]),
  );
  const after = result.vacancies[0].batches[0];
  expect(after.applications[0].blocks).toEqual([]);
  expect(after.applications[0].name).toBe("");
  expect(after.snapshot?.applications).toEqual([]);
  expect(after.snapshot?.selected).toEqual([]);
  expect(after.snapshot?.reason).not.toContain("mentions name");
  expect(
    s.vacancies[0].batches[0].applications[0].blocks.length,
  ).toBeGreaterThan(0);
});
