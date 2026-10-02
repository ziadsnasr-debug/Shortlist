import { describe, it, expect } from "vitest";
import { seed, samples, sampleRubric } from "../fixtures/synthetic/seed";
import {
  Action,
  applyAction,
  reviewBlockers,
  score,
  ranking,
  highest,
  publicState,
  exportBatch,
  csvCell,
  validateRubric,
  type Workspace,
} from "../lib/workflow";
import { validatePass, mergePasses } from "../lib/assessment";
function command(state: Workspace, action: Action) {
  return applyAction(
    state,
    action,
    "reviewer-test",
    () => crypto.randomUUID(),
    samples,
  );
}
const base = { vacancyId: "customer-success", batchId: "first-batch" };
function opened() {
  let s = seed();
  s = command(s, { ...base, type: "publish" });
  s = command(s, { ...base, type: "samples" });
  return s;
}
function ready() {
  return command(opened(), { ...base, type: "close" });
}
function batch(s: Workspace) {
  return s.vacancies[0].batches[0];
}
function confirm(s: Workspace, index: number) {
  const a = batch(s).applications[index];
  return command(s, {
    ...base,
    type: "review",
    applicationId: a.id,
    runId: a.runId,
    documentVersion: 1,
    sourceChecked: true,
    confirm: true,
    attest: true,
    decisions: Object.fromEntries(
      Object.entries(a.assessments).map(([id, v]) => [
        id,
        {
          category: v.category === "UNCLEAR" ? "FULL" : v.category,
          evidence: v.evidence,
          checked: true,
          reason:
            v.category === "UNCLEAR"
              ? "The stated workflow supports direct CRM use."
              : "",
        },
      ]),
    ),
  });
}
function reviewed() {
  let s = ready();
  for (let i = 0; i < 6; i++) s = confirm(s, i);
  return s;
}
describe("server workflow", () => {
  it("rejects a fourth selected applicant at request validation", () => {
    expect(() =>
      Action.parse({
        ...base,
        type: "selection",
        selected: ["A101", "A102", "A103", "A104"],
        reason: "test",
        tieReason: "",
        exceptions: {},
      }),
    ).toThrow();
  });

  it("starts at Criteria without applications or ranking", () => {
    const s = seed();
    expect(batch(s).applications).toHaveLength(0);
    expect(publicState(s).vacancies[0].batches[0].ranking).toBeNull();
  });
  it("requires exactly 100 positive integer points and unique criteria", () => {
    expect(() => validateRubric(sampleRubric)).not.toThrow();
    for (const points of [0, -1, 12.5])
      expect(() => validateRubric([{ ...sampleRubric[0], points }])).toThrow();
    expect(() => validateRubric(sampleRubric.slice(1))).toThrow();
    expect(() =>
      validateRubric(sampleRubric.map((c) => ({ ...c, id: "duplicate" }))),
    ).toThrow();
  });
  it("freezes published criteria", () => {
    expect(() =>
      command(opened(), { ...base, type: "rubric", rubric: sampleRubric }),
    ).toThrow("frozen");
  });
  it("blocks confirmation before intake closes", () =>
    expect(() => confirm(opened(), 0)).toThrow("Close intake"));
  it("uses exact half points and fixed denominator", () => {
    const s = confirm(ready(), 0);
    expect(score(batch(s), batch(s).applications[0])).toBe(92.5);
  });
  it("unknown is unresolved, not zero", () => {
    const s = ready();
    expect(
      reviewBlockers(batch(s), batch(s).applications[1]).join(" "),
    ).toContain("needs your judgement");
    expect(score(batch(s), batch(s).applications[1])).toBeNull();
  });
  it("hides names and comparative ranking in server response", () => {
    const s = confirm(ready(), 0),
      view = publicState(s, true).vacancies[0].batches[0];
    expect(view.ranking).toBeNull();
    expect(view.applications[0].name).toBeUndefined();
    expect(view.applications[0].score).toBeNull();
    expect(() => ranking(batch(s))).toThrow();
  });
  it("blocks missing essential checks, source warnings and unsupported credit", () => {
    const s = ready(),
      a = batch(s).applications[0];
    a.assessments.c1.checked = false;
    expect(reviewBlockers(batch(s), a).join(" ")).toContain("individual check");
    a.assessments.c1.evidence = [];
    expect(reviewBlockers(batch(s), a).join(" ")).toContain("source passage");
    const warning = batch(s).applications[3];
    expect(reviewBlockers(batch(s), warning).join(" ")).toContain(
      "flagged source",
    );
  });
  it("rejects stale assessment IDs and incomplete decision sets", () => {
    const s = ready(),
      a = batch(s).applications[0];
    expect(() =>
      command(s, {
        ...base,
        type: "review",
        applicationId: a.id,
        runId: "other",
        documentVersion: 1,
        decisions: {},
        sourceChecked: false,
        confirm: true,
        attest: true,
      }),
    ).toThrow("Reload");
    expect(() =>
      command(s, {
        ...base,
        type: "review",
        applicationId: a.id,
        runId: a.runId,
        documentVersion: 1,
        decisions: {},
        sourceChecked: false,
        confirm: true,
        attest: true,
      }),
    ).toThrow("exact criterion");
  });
  it("only reveals ranking after all reviews", () => {
    let s = ready();
    for (let i = 0; i < 5; i++) s = confirm(s, i);
    expect(() => ranking(batch(s))).toThrow();
    s = confirm(s, 5);
    expect(ranking(batch(s))).toHaveLength(6);
    expect(
      publicState(s, true).vacancies[0].batches[0].applications[0].name,
    ).toBe("Morgan Ellis");
  });
  it("stops automatic highest-score selection at third-place tie", () => {
    const b = batch(reviewed());
    expect(highest(b)).toEqual(["A101", "A102"]);
  });
  it("requires written tie decision before freezing third place", () => {
    let s = reviewed();
    s = command(s, {
      ...base,
      type: "selection",
      selected: ["A101", "A102", "A103"],
      reason: "Evidence matched role needs.",
      tieReason: "",
      exceptions: {},
    });
    expect(() => command(s, { ...base, type: "finalise" })).toThrow(
      "boundary tie",
    );
    s = command(s, {
      ...base,
      type: "selection",
      selected: ["A101", "A102", "A103"],
      reason: "Evidence matched role needs.",
      tieReason:
        "Human reviewed tied evidence and selected A103 for reporting examples.",
      exceptions: {},
    });
    s = command(s, { ...base, type: "finalise" });
    expect(batch(s).snapshot?.selected).toHaveLength(3);
    expect(() => command(s, { ...base, type: "samples" })).toThrow("immutable");
  });
  it("supports empty shortlist, but requires reason", () => {
    let s = reviewed();
    expect(() => command(s, { ...base, type: "finalise" })).toThrow("reason");
    s = command(s, {
      ...base,
      type: "selection",
      selected: [],
      reason: "No candidate selected for this synthetic exercise.",
      tieReason: "",
      exceptions: {},
    });
    s = command(s, { ...base, type: "finalise" });
    expect(batch(s).snapshot?.selected).toEqual([]);
    expect(exportBatch(s.vacancies[0], batch(s))).not.toContain("Morgan Ellis");
  });
  it("requires individual essential exceptions", () => {
    let s = reviewed();
    s = command(s, {
      ...base,
      type: "selection",
      selected: ["A105"],
      reason: "Relevant reporting evidence supports exception.",
      tieReason: "",
      exceptions: {},
    });
    expect(() => command(s, { ...base, type: "finalise" })).toThrow(
      "exception",
    );
  });
  it("retains reasoned dispositions and disallows them after close", () => {
    let s = opened();
    s = command(s, {
      ...base,
      type: "dispose",
      applicationId: "A101",
      disposition: "duplicate",
      reason: "Same synthetic application received twice.",
    });
    expect(batch(s).applications[0].state).toBe("disposed");
    s = command(s, { ...base, type: "close" });
    expect(() =>
      command(s, {
        ...base,
        type: "dispose",
        applicationId: "A102",
        disposition: "withdrawal",
        reason: "Withdrew",
      }),
    ).toThrow("before intake closes");
  });
  it("changing a reviewed application clears confirmation and provisional selection", () => {
    let s = reviewed();
    s = command(s, {
      ...base,
      type: "selection",
      selected: ["A101"],
      reason: "draft",
      tieReason: "",
      exceptions: {},
    });
    const a = batch(s).applications[0];
    s = command(s, {
      ...base,
      type: "review",
      applicationId: a.id,
      runId: a.runId,
      documentVersion: 1,
      decisions: Object.fromEntries(
        Object.entries(a.assessments).map(([id, v]) => [
          id,
          {
            category: v.category,
            evidence: v.evidence,
            checked: true,
            reason: v.reason,
          },
        ]),
      ),
      sourceChecked: true,
      confirm: false,
      attest: false,
    });
    expect(batch(s).selected).toEqual([]);
    expect(batch(s).applications[0].confirmed).toBe(false);
    expect(() => ranking(batch(s))).toThrow();
  });
  it("new batch preserves frozen prior snapshot", () => {
    let s = reviewed();
    s = command(s, {
      ...base,
      type: "selection",
      selected: [],
      reason: "Practice batch.",
      tieReason: "",
      exceptions: {},
    });
    s = command(s, { ...base, type: "finalise" });
    const frozen = structuredClone(batch(s));
    s = command(s, { ...base, type: "next", label: "Next week" });
    expect(batch(s)).toEqual(frozen);
    expect(s.vacancies[0].batches[1].applications).toEqual([]);
  });
  it("never treats processing failure as score or allows silent closure", () => {
    const s = opened();
    batch(s).applications[0].state = "readable_copy";
    expect(() => command(s, { ...base, type: "close" })).toThrow("unreadable");
    expect(score(batch(s), batch(s).applications[0])).toBeNull();
  });
});
describe("untrusted model output", () => {
  const a = samples(sampleRubric, 1)[0];
  const valid = {
    criteria: sampleRubric.map((c, i) => ({
      criterion_id: c.id,
      category: "FULL",
      evidence_ids: [a.blocks[i].id],
      rationale: "Source describes relevant responsibilities.",
    })),
  };
  it("validates categories and current source references", () =>
    expect(validatePass(valid, sampleRubric, a).criteria).toHaveLength(6));
  it.each(["duplicate", "foreign", "unsupported", "extra", "long", "stale"])(
    "rejects %s output",
    (kind) => {
      const input = structuredClone(valid);
      if (kind === "duplicate") input.criteria[1].criterion_id = "c1";
      if (kind === "foreign") input.criteria[0].evidence_ids = ["other-CV"];
      if (kind === "unsupported") input.criteria[0].evidence_ids = [];
      if (kind === "extra")
        Object.assign(input.criteria[0], { command: "fetch secrets" });
      if (kind === "long")
        input.criteria[0].rationale = Array(26).fill("word").join(" ");
      const app = structuredClone(a);
      if (kind === "stale") app.documentVersion = 2;
      expect(() => validatePass(input, sampleRubric, app)).toThrow();
    },
  );
  it("routes disagreement and invalid output to UNCLEAR", () => {
    const other = structuredClone(valid);
    other.criteria[0].category = "PARTIAL";
    expect(mergePasses(valid, other, sampleRubric, a).c1.category).toBe(
      "UNCLEAR",
    );
    expect(
      Object.values(
        mergePasses(valid, { criteria: [] }, sampleRubric, a),
      ).every((x) => x.category === "UNCLEAR"),
    ).toBe(true);
  });
});
describe("CSV injection", () => {
  it.each(["=SUM(A1)", " +cmd", "\u0001@evil", "\t-2", "\r=cmd", "\n@evil"])(
    "neutralises formula cell %j",
    (text) => expect(csvCell(text).startsWith("\"'")).toBe(true),
  );
  it("quotes commas and embedded quotes", () =>
    expect(csvCell('a,"b"')).toBe('"a,""b"""'));
});
