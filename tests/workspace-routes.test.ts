import { describe, expect, it } from "vitest";
import { defaultStep, parsePath, pathFor } from "@/components/workflow/routes";

describe("workspace routes", () => {
  it("treats the root and the vacancy list as home", () => {
    expect(parsePath("/")).toEqual({ view: "home" });
    expect(parsePath("/vacancies")).toEqual({ view: "home" });
    expect(parsePath("/vacancies/")).toEqual({ view: "home" });
  });

  it("parses the new-vacancy and administration pages", () => {
    expect(parsePath("/vacancies/new")).toEqual({ view: "new" });
    expect(parsePath("/admin")).toEqual({ view: "admin" });
  });

  it("parses each workflow step and the review candidate", () => {
    const base = { view: "batch", vacancyId: "v1", batchId: "b1" };
    expect(parsePath("/vacancies/v1/b1")).toEqual({ ...base, step: 0 });
    expect(parsePath("/vacancies/v1/b1/criteria")).toEqual({
      ...base,
      step: 0,
    });
    expect(parsePath("/vacancies/v1/b1/cvs")).toEqual({ ...base, step: 1 });
    expect(parsePath("/vacancies/v1/b1/review")).toEqual({ ...base, step: 2 });
    expect(parsePath("/vacancies/v1/b1/review/03")).toEqual({
      ...base,
      step: 2,
      candidate: 3,
    });
    expect(parsePath("/vacancies/v1/b1/shortlist")).toEqual({
      ...base,
      step: 3,
    });
  });

  it("rejects unknown or malformed paths", () => {
    for (const path of [
      "/elsewhere",
      "/admin/extra",
      "/vacancies/v1/b1/scores",
      "/vacancies/v1/b1/criteria/03",
      "/vacancies/v1/b1/review/abc",
      "/vacancies/v1/b1/review/03/more",
      "/vacancies/bad%20id/b1/criteria",
    ])
      expect(parsePath(path)).toEqual({ view: "missing" });
  });

  it("round-trips every route through its path", () => {
    for (const path of [
      "/vacancies",
      "/vacancies/new",
      "/admin",
      "/vacancies/v1/b1/criteria",
      "/vacancies/v1/b1/cvs",
      "/vacancies/v1/b1/review",
      "/vacancies/v1/b1/review/07",
      "/vacancies/v1/b1/shortlist",
    ])
      expect(pathFor(parsePath(path))).toBe(path);
  });

  it("opens a batch on the next action", () => {
    expect(defaultStep({ published: false, closed: false })).toBe(0);
    expect(defaultStep({ published: true, closed: false })).toBe(1);
    expect(defaultStep({ published: true, closed: true })).toBe(2);
    expect(defaultStep({ published: true, closed: true, snapshot: {} })).toBe(
      3,
    );
  });
});
