const rawBase = process.env.SHORTLIST_HOSTED_URL;
if (!rawBase)
  throw new Error(
    "Set SHORTLIST_HOSTED_URL to the approved hosted synthetic URL.",
  );
const parsedBase = new URL(rawBase);
if (parsedBase.protocol !== "https:")
  throw new Error("SHORTLIST_HOSTED_URL must use HTTPS.");
const base = rawBase.replace(/\/$/, "");

export {};

const checks = [
  { path: "/login", expected: 200 },
  { path: "/api/readiness", expected: 401 },
];

async function request(path: string) {
  return fetch(`${base}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
}

for (const check of checks) {
  const response = await request(check.path);
  if (response.status !== check.expected) {
    throw new Error(
      `${check.path} expected ${check.expected}, received ${response.status}`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (check.path === "/login" && !contentType.includes("text/html")) {
    throw new Error(
      `/login did not return HTML (${contentType || "missing content type"})`,
    );
  }
  if (
    check.path === "/api/readiness" &&
    !contentType.includes("application/json")
  ) {
    throw new Error(
      `/api/readiness did not return JSON (${contentType || "missing content type"})`,
    );
  }
  if (response.headers.get("cache-control")?.includes("no-store") !== true) {
    throw new Error(`${check.path} is not marked no-store`);
  }
}

const readiness = await request("/api/readiness");
const body = await readiness.text();
if (!body.includes('"error":"ACCESS_DENIED"')) {
  throw new Error(
    "unauthenticated readiness response did not use ACCESS_DENIED",
  );
}

console.log(
  `PASS: hosted unauthenticated smoke (${base}); login renders and readiness remains protected.`,
);
