import { expect, it } from "vitest";
import { collectPages } from "../lib/recovery-export";
it("exports more than the API cap without losing deletion records", async () => {
  const records = Array.from({ length: 1005 }, (_, i) => ({ id: String(i) }));
  const result = await collectPages(async (start, end) => ({
    data: records.slice(start, end + 1),
    count: 1005,
    error: null,
  }));
  expect(result).toEqual(records);
});
it("refuses silent truncation, changed counts, duplicate IDs and missing count", async () => {
  await expect(
    collectPages(async () => ({
      data: [{ id: "one" }],
      count: 1005,
      error: null,
    })),
  ).rejects.toThrow("TRUNCATED");
  await expect(
    collectPages(
      async (start) => ({
        data: [{ id: String(start) }],
        count: start ? 3 : 2,
        error: null,
      }),
      "id",
      1,
    ),
  ).rejects.toThrow("CHANGED");
  await expect(
    collectPages(
      async () => ({ data: [{ id: "one" }], count: 2, error: null }),
      "id",
      1,
    ),
  ).rejects.toThrow("INTEGRITY");
  await expect(
    collectPages(async () => ({ data: [], count: null, error: null })),
  ).rejects.toThrow("INCOMPLETE");
});
