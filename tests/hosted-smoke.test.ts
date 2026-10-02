import { describe, expect, it } from "vitest";
import { approvedHostedUrl, runHostedSmoke, type SmokeResponse } from "@/lib/hosted-smoke";

const response = (status: number, headers: Record<string, string>, body = '{"error":"ACCESS_DENIED"}'): SmokeResponse => ({
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text: async () => body,
});
const fake = (routes: Record<string, SmokeResponse>) => async (input: string) => routes[new URL(input).pathname] ?? response(404, {});
const json = (status: number) => response(status, { "content-type": "application/json", "cache-control": "private, no-store" });

describe("hosted smoke", () => {
  it("requires an exact HTTPS origin", () => {
    expect(() => approvedHostedUrl("http://example.test")).toThrow(/HTTPS/);
    expect(() => approvedHostedUrl("https://example.test/?token=x")).toThrow(/query/);
    expect(() => approvedHostedUrl("https://user:pass@example.test")).toThrow(/credentials/);
    expect(() => approvedHostedUrl("https://example.test/vacancies")).toThrow(/approved app origin/);
  });
  it("keeps authenticated mode strict", async () => {
    const fetcher = fake({
      "/login": response(200, { "content-type": "text/html", "cache-control": "private, no-store" }, "<html>login</html>"),
      "/api/readiness": json(401), "/api/administration": json(401), "/api/retention": json(401),
    });
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: false, fetcher })).resolves.toMatchObject({ mode: "authenticated" });
  });
  it("accepts only same-origin temporary-public redirects", async () => {
    const fetcher = fake({
      "/login": response(307, { location: "/vacancies", "cache-control": "private, no-store" }),
      "/vacancies": response(200, { "content-type": "text/html", "cache-control": "private, no-store" }, "<html>app</html>"),
      "/api/readiness": json(403), "/api/administration": json(403), "/api/retention": json(403),
    });
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: true, fetcher })).resolves.toMatchObject({ mode: "temporary-public" });
  });
  it("rejects foreign redirects, public sensitive surfaces and cache violations", async () => {
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: false, fetcher: fake({ "/login": response(307, { location: "/vacancies", "cache-control": "no-store" }) }) })).rejects.toThrow(/expected 200/);
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: true, fetcher: fake({ "/login": response(307, { location: "https://evil.test/", "cache-control": "no-store" }) }) })).rejects.toThrow(/same-origin|approved app path/);
    const publicAdmin = fake({ "/login": response(307, { location: "/", "cache-control": "no-store" }), "/": response(200, { "content-type": "text/html", "cache-control": "no-store" }), "/api/readiness": json(403), "/api/administration": response(200, { "content-type": "application/json", "cache-control": "no-store" }, "{}") });
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: true, fetcher: publicAdmin })).rejects.toThrow(/administration expected 403/);
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: false, fetcher: fake({ "/login": response(200, { "content-type": "text/html", "cache-control": "public, max-age=60" }) }) })).rejects.toThrow(/no-store/);
    await expect(runHostedSmoke({ rawUrl: "https://example.test", temporaryPublic: true, fetcher: fake({ "/login": response(307, { location: "https://user:pass@example.test/vacancies", "cache-control": "no-store" }) }) })).rejects.toThrow(/approved app path/);
  });
});
