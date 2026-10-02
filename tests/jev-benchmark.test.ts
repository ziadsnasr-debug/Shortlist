import { expect, it } from "vitest";
import { benchmarkCases } from "../scripts/benchmark/fixtures";
import { decodeJev, jevRequest, JEV_MODEL } from "../scripts/benchmark/jev";
const fixture = benchmarkCases[0];
function response(category = "FULL", source = "b1") {
  const request = jevRequest(fixture.app, fixture.rubric);
  return {
    model: JEV_MODEL,
    usage: { input_tokens: 100, output_tokens: 5 },
    answers: Object.fromEntries(
      Object.entries(request.questions).map(([id, q]) => {
        const choice = id.endsWith("category") ? category : source;
        return [
          id,
          {
            type: "choice",
            choice,
            confidence: 1,
            probabilities: Object.fromEntries(
              Object.keys(q.criteria).map((option) => [
                option,
                option === choice ? 1 : 0,
              ]),
            ),
          },
        ];
      }),
    ),
  };
}
it("refuses oversize source sets instead of truncating", () => {
  const app = {
    ...fixture.app,
    blocks: Array.from({ length: 253 }, (_, i) => ({
      ...fixture.app.blocks[0],
      id: `b${i}`,
    })),
  };
  expect(() => jevRequest(app, fixture.rubric)).toThrow("JEV_CHOICE_LIMIT");
});
it("requires the pinned model and exact answer and probability option sets", () => {
  expect(
    decodeJev(response(), fixture.app, fixture.rubric).output.criteria[0]
      .category,
  ).toBe("FULL");
  expect(() =>
    decodeJev(
      { ...response(), model: "jev-latest" },
      fixture.app,
      fixture.rubric,
    ),
  ).toThrow();
  const foreign = response();
  foreign.answers.c1_source.choice = "invented";
  expect(() => decodeJev(foreign, fixture.app, fixture.rubric)).toThrow(
    "JEV_FOREIGN_CHOICE",
  );
  const incomplete = response();
  delete incomplete.answers.c1_source.probabilities.NONE;
  expect(() => decodeJev(incomplete, fixture.app, fixture.rubric)).toThrow(
    "JEV_FOREIGN_CHOICE",
  );
});
it("abstains on unsupported, conflicting and multi-source positive classifications", () => {
  for (const source of ["NONE", "CONFLICT", "MULTIPLE_REQUIRED"]) {
    const result = decodeJev(
      response("FULL", source),
      fixture.app,
      fixture.rubric,
    );
    expect(result.output.criteria[0].category).toBe("UNCLEAR");
    expect(result.output.criteria[0].evidence_ids).toEqual([]);
  }
});
