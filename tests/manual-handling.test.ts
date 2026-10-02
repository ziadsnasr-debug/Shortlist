import { it, expect } from "vitest";
import { seed, samples } from "../fixtures/synthetic/seed";
import { applyAction, Action } from "../lib/workflow";
function pending() {
  const s = seed(),
    b = s.vacancies[0].batches[0];
  b.published = true;
  b.applications = samples(b.rubric, 1);
  b.applications[0].state = "readable_copy";
  return s;
}
const base = { vacancyId: "customer-success", batchId: "first-batch" };
it("unreadable, processing and attention states block intake closure", () => {
  for (const state of ["readable_copy", "processing", "attention"] as const) {
    const s = pending();
    s.vacancies[0].batches[0].applications[0].state = state;
    expect(() =>
      applyAction(
        s,
        { ...base, type: "close" },
        "reviewer",
        () => "id",
        samples,
      ),
    ).toThrow();
  }
});
it("checked manual passages remain unresolved human work with stable source IDs and new version", () => {
  const s = pending(),
    before = s.vacancies[0].batches[0].applications[0];
  const result = applyAction(
    s,
    {
      ...base,
      type: "manual_source",
      applicationId: before.id,
      name: "Fictional name",
      passages: [{ locator: "Page 1", text: "Manually checked CRM passage" }],
      reason: "Scan required transcription.",
      attest: true,
    },
    "reviewer",
    () => "new-run",
    samples,
  );
  const after = result.vacancies[0].batches[0].applications[0];
  expect(after.state).toBe("ready");
  expect(after.documentVersion).toBe(2);
  expect(after.blocks[0].inputMethod).toBe("manual");
  expect(
    Object.values(after.assessments).every((a) => a.category === "UNCLEAR"),
  ).toBe(true);
  expect(after.confirmed).toBe(false);
});
it("manual handling cannot rewrite a readable or closed application", () => {
  const s = pending(),
    b = s.vacancies[0].batches[0],
    action = Action.parse({
      ...base,
      type: "manual_source",
      applicationId: b.applications[0].id,
      name: "",
      passages: [{ locator: "Page 1", text: "CV" }],
      reason: "Checked.",
      attest: true,
    });
  b.closed = true;
  expect(() =>
    applyAction(s, action, "reviewer", () => "new-run", samples),
  ).toThrow();
});
