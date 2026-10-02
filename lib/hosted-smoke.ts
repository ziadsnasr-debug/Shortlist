export type SmokeResponse = {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type SmokeFetch = (input: string, init: { redirect: "manual"; signal: AbortSignal }) => Promise<SmokeResponse>;
export type HostedSmokeOptions = { rawUrl: string; temporaryPublic: boolean; fetcher?: SmokeFetch };
const timeoutMs = 10_000;
const appPaths = new Set(["", "/", "/vacancies"]);

export function approvedHostedUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("SHORTLIST_HOSTED_URL must use HTTPS.");
  if (url.username || url.password || url.search || url.hash)
    throw new Error("SHORTLIST_HOSTED_URL must be an origin without credentials, query or hash.");
  if (url.pathname !== "" && url.pathname !== "/") throw new Error("SHORTLIST_HOSTED_URL must point to the approved app origin.");
  return url.origin;
}

function noStore(response: SmokeResponse, path: string) {
  if (!response.headers.get("cache-control")?.toLowerCase().includes("no-store")) throw new Error(`${path} is not marked no-store`);
}
function sameOriginAppLocation(location: string, origin: string) {
  const target = new URL(location, origin);
  if (target.origin !== origin || target.username || target.password || !appPaths.has(target.pathname) || target.search || target.hash)
    throw new Error("/login redirect did not stay on an approved app path");
  return target.href;
}

export async function runHostedSmoke(options: HostedSmokeOptions) {
  const base = approvedHostedUrl(options.rawUrl);
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const request = (path: string) => fetcher(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  const denied = options.temporaryPublic ? 403 : 401;
  const login = await request("/login");
  noStore(login, "/login");
  if (options.temporaryPublic) {
    if (![307, 308].includes(login.status)) throw new Error(`/login expected a temporary-public redirect, received ${login.status}`);
    const location = login.headers.get("location");
    if (!location) throw new Error("/login temporary-public redirect had no location");
    const app = await fetcher(sameOriginAppLocation(location, base), { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    noStore(app, "/login redirect target");
    if (app.status !== 200 || !app.headers.get("content-type")?.includes("text/html")) throw new Error("/login redirect target did not return app HTML");
  } else {
    if (login.status !== 200) throw new Error(`/login expected 200, received ${login.status}`);
    if (!login.headers.get("content-type")?.includes("text/html")) throw new Error("/login did not return HTML");
  }
  for (const path of ["/api/readiness", "/api/administration", "/api/retention"]) {
    const response = await request(path);
    noStore(response, path);
    if (response.status !== denied) throw new Error(`${path} expected ${denied}, received ${response.status}`);
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) throw new Error(`${path} did not return JSON`);
    if (path === "/api/readiness" && !(await response.text()).includes('"error":"ACCESS_DENIED"'))
      throw new Error(`${path} unauthenticated response did not use ACCESS_DENIED`);
  }
  return { base, mode: options.temporaryPublic ? "temporary-public" : "authenticated" } as const;
}
