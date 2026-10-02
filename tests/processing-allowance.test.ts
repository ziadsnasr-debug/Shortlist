import { describe, expect, it } from "vitest";
import {
  allowanceState,
  currentUtcAllowancePeriod,
  makeProcessingAllowance,
} from "../lib/processing-allowance";

describe("processing allowance", () => {
  it("uses the UTC month boundary", () => {
    expect(currentUtcAllowancePeriod(new Date("2026-10-01T00:30:00Z"))).toBe("2026-10-01");
    expect(currentUtcAllowancePeriod(new Date("2026-09-30T23:59:59-05:00"))).toBe("2026-10-01");
  });

  it.each([
    [0, 100, "normal"],
    [79, 100, "normal"],
    [80, 100, "near_limit"],
    [99, 100, "near_limit"],
    [100, 100, "exhausted"],
    [150, 100, "exhausted"],
  ] as const)("classifies %s of %s as %s", (used, limit, state) => {
    expect(allowanceState(used, limit)).toBe(state);
  });

  it("keeps remaining non-negative when a lowered cap is below usage", () => {
    expect(
      makeProcessingAllowance({ period: "2026-10-01", used: 150, limit: 100 }),
    ).toEqual({
      period: "2026-10-01",
      used: 150,
      limit: 100,
      remaining: 0,
      state: "exhausted",
    });
  });

  it.each([
    { used: -1, limit: 100 },
    { used: 1.5, limit: 100 },
    { used: 1, limit: 0 },
    { used: 1, limit: 1001 },
  ])("rejects invalid counts and caps: %j", (input) => {
    expect(() => makeProcessingAllowance({ period: "2026-10-01", ...input })).toThrow(
      /Invalid processing allowance/,
    );
  });
});
