import { it, expect } from "vitest";
import { seed, samples } from "../fixtures/synthetic/seed";
import {
  recordId,
  reapplyDeletions,
  reconcileRestoreAttribution,
} from "../lib/recovery";

it("fresh-target restore separates current reviewer references from immutable history", () => {
  const state = seed(),
    batch = state.vacancies[0].batches[0];
  batch.applications = samples(batch.rubric, batch.rubricVersion);
  const app = batch.applications[0];
  app.reviewedBy = "source-only-user";
  app.confirmed = true;
  batch.snapshot = {
    at: "fixture",
    actor: "source-only-user",
    reason: "reviewed",
    tieReason: "",
    exceptions: {},
    selected: [],
    rubricVersion: 1,
    rubric: batch.rubric,
    applications: [
      {
        id: app.id,
        score: 100,
        assessments: app.assessments,
        blocks: app.blocks,
        documentVersion: 1,
        runId: app.runId,
        reviewedBy: "source-only-user",
      },
    ],
  };
  const result = reconcileRestoreAttribution(state);
  expect(
    result.vacancies[0].batches[0].applications[0].reviewedBy,
  ).toBeUndefined();
  expect(result.vacancies[0].batches[0].applications[0].confirmed).toBe(true);
  expect(app.reviewedBy).toBe("source-only-user");
  expect(
    result.vacancies[0].batches[0].snapshot?.applications[0].reviewedBy,
  ).toBe("source-only-user");
});
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
