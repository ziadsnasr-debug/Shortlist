import { expect, it, vi } from "vitest";
import { boundedFetch } from "../lib/bounded-fetch";
const pending: typeof fetch = async (_input, init) =>
  new Promise((_resolve, reject) => {
    const signal = init!.signal!;
    if (signal.aborted) reject(signal.reason);
    else
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
  });
it("bounds a stalled backend request", async () => {
  await expect(
    boundedFetch(10, pending)("https://example.invalid"),
  ).rejects.toMatchObject({ name: "TimeoutError" });
});
it("preserves caller cancellation and request bodies", async () => {
  const caller = new AbortController();
  caller.abort(new Error("CANCELLED"));
  await expect(
    boundedFetch(1000, pending)("https://example.invalid", {
      signal: caller.signal,
    }),
  ).rejects.toThrow("CANCELLED");
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
  await boundedFetch(1000, transport)("https://example.invalid", {
    method: "POST",
    body: "safe",
  });
  expect(transport.mock.calls[0][1]).toMatchObject({
    method: "POST",
    body: "safe",
  });
});
it("enforces one absolute budget across two individually successful-duration calls", async () => {
  let calls = 0;
  const transport: typeof fetch = async (_input, init) => {
    const delay = ++calls === 1 ? 40 : 300;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response("ok")), delay);
      const signal = init!.signal!;
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    });
  };
  const request = boundedFetch(500, transport, Date.now() + 180);
  expect((await request("https://example.invalid/one")).ok).toBe(true);
  await expect(request("https://example.invalid/two")).rejects.toMatchObject({
    name: "TimeoutError",
  });
  expect(calls).toBe(2);
});
