// Explicit integration harness for disposable LOCAL synthetic users only.
// Credentials remain in memory; never print provider output or auth objects.
import { execFileSync, spawn } from "node:child_process";
import { randomUUID, createHmac, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { seed, samples } from "../fixtures/synthetic/seed";
import { applyAction, type Action, type Workspace } from "../lib/workflow";
const settings = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert(
  new URL(settings.API_URL).hostname === "127.0.0.1",
  "Local database only.",
);
const db = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
function totp(secret: string) {
  let bits = "";
  const bytes: number[] = [];
  for (const char of secret.toUpperCase()) {
    const index = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
      .update(counter)
      .digest(),
    offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const users: {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  factorId: string;
  secret: string;
}[] = [];
let workspaceId = "",
  server: ReturnType<typeof spawn> | undefined;
try {
  for (let i = 0; i < 3; i++) {
    const email = `shortlist-${randomUUID()}@example.invalid`,
      password = randomBytes(24).toString("hex");
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert(!error && data.user, "Synthetic user setup failed.");
    const client = createClient(settings.API_URL, settings.ANON_KEY, {
      auth: { persistSession: false },
    });
    assert(!(await client.auth.signInWithPassword({ email, password })).error);
    const { data: factor, error: factorError } = await client.auth.mfa.enroll({
      factorType: "totp",
    });
    assert(!factorError && factor);
    assert(
      !(
        await client.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: totp(factor.totp.secret),
        })
      ).error,
    );
    users.push({
      id: data.user.id,
      email,
      password,
      client,
      factorId: factor.id,
      secret: factor.totp.secret,
    });
  }
  const { data: w, error } = await db
    .from("workspaces")
    .insert({ name: "Disposable synthetic integration" })
    .select("id")
    .single();
  assert(!error && w);
  workspaceId = w.id;
  assert(
    !(
      await db
        .from("workspace_members")
        .insert(
          users
            .slice(0, 2)
            .map((u, i) => ({
              workspace_id: workspaceId,
              user_id: u.id,
              role: i ? "reviewer" : "administrator",
            })),
        )
    ).error,
  );
  assert(
    !(
      await db
        .from("synthetic_workspaces")
        .insert({ workspace_id: workspaceId, payload: seed(), version: 0 })
    ).error,
  );
  const [admin, reviewer, outsider] = users;
  assert(
    (
      await reviewer.client
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
    ).data?.length === 2,
  );
  assert(
    (
      await outsider.client
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
    ).data?.length === 0,
  );
  assert(
    (await reviewer.client.from("synthetic_workspaces").select("*")).error,
    "Direct aggregate read must fail.",
  );
  assert(
    (
      await reviewer.client
        .from("workspace_members")
        .update({ role: "administrator" })
        .eq("user_id", reviewer.id)
    ).error,
    "Role escalation must fail.",
  );
  assert(
    (
      await reviewer.client.rpc("save_synthetic_workspace", {
        p_workspace: workspaceId,
        p_actor: reviewer.id,
        p_expected: 0,
        p_payload: seed(),
        p_operation: "review",
      })
    ).error,
    "Direct RPC bypass must fail.",
  );
  const bucket = (await db.storage.getBucket("cv-originals")).data;
  assert(bucket?.public === false);
  assert(
    (
      await outsider.client.storage
        .from("cv-originals")
        .upload(`${workspaceId}/forged.pdf`, Buffer.from("%PDF fake"))
    ).error,
    "Forged upload must fail.",
  );
  server = spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3219",
    ],
    {
      env: {
        ...process.env,
        PERSISTENCE_MODE: "supabase-synthetic",
        NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: settings.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
        WORKSPACE_ID: workspaceId,
      },
      stdio: "ignore",
    },
  );
  const origin = "http://127.0.0.1:3219";
  for (let n = 0; n < 80; n++) {
    try {
      await fetch(origin);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  assert((await fetch(origin + "/api/workspace")).status === 401);
  async function signed(u: typeof admin) {
    let cookie = "";
    async function auth(body: unknown) {
      const r = await fetch(origin + "/api/auth", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      });
      const updates = r.headers.getSetCookie().map((s) => s.split(";")[0]);
      const map = new Map(
        cookie
          .split("; ")
          .filter(Boolean)
          .map((s) => {
            const i = s.indexOf("=");
            return [s.slice(0, i), s.slice(i + 1)];
          }),
      );
      for (const s of updates) {
        const i = s.indexOf("=");
        map.set(s.slice(0, i), s.slice(i + 1));
      }
      cookie = [...map].map(([k, v]) => `${k}=${v}`).join("; ");
      assert(r.status === 200, "Local authentication action failed.");
      return r.json();
    }
    await auth({ type: "login", email: u.email, password: u.password });
    assert(
      (await fetch(origin + "/api/workspace", { headers: { Cookie: cookie } }))
        .status === 403,
      "MFA gate must deny aal1.",
    );
    await auth({ type: "verify", factorId: u.factorId, code: totp(u.secret) });
    return () => cookie;
  }
  const adminCookie = await signed(admin),
    reviewerCookie = await signed(reviewer),
    outsiderCookie = await signed(outsider);
  assert(
    (
      await fetch(origin + "/api/workspace", {
        headers: { Cookie: outsiderCookie() },
      })
    ).status === 403,
  );
  async function read(cookie: () => string) {
    const r = await fetch(origin + "/api/workspace", {
      headers: { Cookie: cookie() },
    });
    assert(r.status === 200);
    return r.json();
  }
  async function post(cookie: () => string, version: number, action: Action) {
    return fetch(origin + "/api/workspace", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json", Cookie: cookie() },
      body: JSON.stringify({ version, action }),
    });
  }
  const base = { vacancyId: "customer-success", batchId: "first-batch" };
  assert(
    (await post(reviewerCookie, 0, { ...base, type: "publish" })).status ===
      403,
  );
  assert(
    (await post(adminCookie, 0, { ...base, type: "publish" })).status === 200,
  );
  assert(
    (await read(reviewerCookie)).version === 1,
    "Second reviewer must resume persisted state.",
  );
  assert(
    (await post(adminCookie, 0, { ...base, type: "samples" })).status === 409,
    "Stale update must fail.",
  );
  const outcomes = await Promise.all([
    post(adminCookie, 1, { ...base, type: "samples" }),
    post(adminCookie, 1, { ...base, type: "samples" }),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  let current: Workspace = (
    await db
      .from("synthetic_workspaces")
      .select("payload")
      .eq("workspace_id", workspaceId)
      .single()
  ).data!.payload;
  current = applyAction(
    current,
    { ...base, type: "close" },
    admin.id,
    randomUUID,
    samples,
  );
  for (const app of current.vacancies[0].batches[0].applications) {
    current = applyAction(
      current,
      {
        ...base,
        type: "review",
        applicationId: app.id,
        runId: app.runId,
        documentVersion: 1,
        sourceChecked: true,
        confirm: true,
        attest: true,
        decisions: Object.fromEntries(
          Object.entries(app.assessments).map(([id, a]) => [
            id,
            {
              category: a.category === "UNCLEAR" ? "FULL" : a.category,
              evidence: a.evidence,
              checked: true,
              reason:
                a.category === "UNCLEAR"
                  ? "Human source inspection supports CRM evidence."
                  : "",
            },
          ]),
        ),
      },
      admin.id,
      randomUUID,
      samples,
    );
  }
  current = applyAction(
    current,
    {
      ...base,
      type: "selection",
      selected: [],
      reason: "Synthetic integration exercise.",
      tieReason: "",
      exceptions: {},
    },
    admin.id,
    randomUUID,
    samples,
  );
  current = applyAction(
    current,
    { ...base, type: "finalise" },
    admin.id,
    randomUUID,
    samples,
  );
  // Setup synthetic final fixture directly, then test SQL immutability, even with privileged RPC.
  assert(
    !(
      await db
        .from("synthetic_workspaces")
        .update({ payload: current, version: current.version })
        .eq("workspace_id", workspaceId)
    ).error,
  );
  const tampered = structuredClone(current);
  tampered.version++;
  tampered.vacancies[0].batches[0].reason = "tampered";
  assert(
    (
      await db.rpc("save_synthetic_workspace", {
        p_workspace: workspaceId,
        p_actor: admin.id,
        p_expected: current.version,
        p_payload: tampered,
        p_operation: "selection",
      })
    ).error,
    "SQL must freeze finalised batch.",
  );
  assert(
    !(
      await db
        .from("workspace_members")
        .update({ active: false })
        .eq("workspace_id", workspaceId)
        .eq("user_id", reviewer.id)
    ).error,
  );
  assert(
    (
      await fetch(origin + "/api/workspace", {
        headers: { Cookie: reviewerCookie() },
      })
    ).status === 403,
    "Removed member must lose access.",
  );
  assert(
    (await db.from("audit_events").select("id").eq("workspace_id", workspaceId))
      .data!.length === 2,
    "Successful saves append safe audit events.",
  );
  console.log(
    "PASS: local Supabase migrations, MFA, membership, outsider/removal denial, role escalation denial, direct RPC/Data API denial, private bucket, forged upload denial, second-reviewer resume, stale/concurrent saves, immutable SQL snapshot, audit append.",
  );
} finally {
  server?.kill("SIGTERM");
  if (workspaceId) {
    assert(/^[0-9a-f-]{36}$/.test(workspaceId));
    execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_shortlist-local",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-c",
        `delete from public.audit_events where workspace_id='${workspaceId}';`,
      ],
      { stdio: "ignore" },
    );
    await db
      .from("synthetic_workspaces")
      .delete()
      .eq("workspace_id", workspaceId);
    await db.from("workspace_members").delete().eq("workspace_id", workspaceId);
    await db.from("workspaces").delete().eq("id", workspaceId);
  }
  for (const u of users) await db.auth.admin.deleteUser(u.id);
}
