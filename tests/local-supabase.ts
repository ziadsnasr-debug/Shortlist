// Explicit integration harness for disposable LOCAL synthetic users only.
// Credentials remain in memory; never print provider output or auth objects.
import { execFileSync, spawn } from "node:child_process";
import { randomUUID, createHmac, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { hash } from "../lib/pipeline/contracts";
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
const invitedUsers: string[] = [];
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
async function cleanupWorkspace(workspaceId: string) {
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
      `delete from pgmq.q_shortlist_documents where message->>'document_id' in (select id::text from public.documents where workspace_id='${workspaceId}'); delete from public.application_reviews where application_id in (select a.id from public.applications a join public.batches b on b.id=a.batch_id join public.vacancies v on v.id=b.vacancy_id where v.workspace_id='${workspaceId}'); delete from public.assessment_runs where application_id in (select a.id from public.applications a join public.batches b on b.id=a.batch_id join public.vacancies v on v.id=b.vacancy_id where v.workspace_id='${workspaceId}'); delete from public.source_blocks where document_id in (select id from public.documents where workspace_id='${workspaceId}'); delete from public.documents where workspace_id='${workspaceId}'; delete from public.applications where batch_id in (select b.id from public.batches b join public.vacancies v on v.id=b.vacancy_id where v.workspace_id='${workspaceId}'); delete from public.batches where vacancy_id in (select id from public.vacancies where workspace_id='${workspaceId}'); delete from public.vacancies where workspace_id='${workspaceId}'; delete from public.processing_allowances where workspace_id='${workspaceId}'; delete from public.deletion_ledger where workspace_id='${workspaceId}'; delete from public.audit_events where workspace_id='${workspaceId}';`,
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
      await db.from("workspace_members").insert(
        users.slice(0, 2).map((u, i) => ({
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
        AI_ENABLED: "false",
        PARSER_SNAPSHOT_ID: "",
        NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: settings.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
        WORKSPACE_ID: workspaceId,
        APP_URL: "http://127.0.0.1:3219",
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
  async function adminAction(cookie: () => string, body: unknown) {
    return fetch(origin + "/api/administration", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json", Cookie: cookie() },
      body: JSON.stringify(body),
    });
  }
  assert(
    (
      await fetch(origin + "/api/administration", {
        headers: { Cookie: reviewerCookie() },
      })
    ).status === 403,
    "Reviewer cannot inspect admin records.",
  );
  assert((await adminAction(reviewerCookie, { type: "process" })).status === 403, "Reviewer cannot trigger administrative processing.");
  assert(
    (
      await adminAction(reviewerCookie, {
        type: "settings",
        paused: true,
        retentionDays: null,
        incidentOwner: "Synthetic incident owner",
      })
    ).status === 403,
  );
  assert(
    (
      await adminAction(adminCookie, {
        type: "settings",
        paused: true,
        retentionDays: 30,
        incidentOwner: "Synthetic incident owner",
      })
    ).status === 200,
  );
  assert(
    (
      await adminAction(adminCookie, {
        type: "settings",
        paused: false,
        retentionDays: null,
        incidentOwner: "",
      })
    ).status === 200,
  );
  const invite = await adminAction(adminCookie, {
    type: "invite",
    email: `shortlist-invite-${randomUUID()}@example.invalid`,
    role: "reviewer",
  });
  assert(invite.status === 200, "Local invitation request failed.");
  const invited = (
    await db
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
  ).data!.filter((m) => !users.some((u) => u.id === m.user_id));
  assert(invited.length === 1, "Invitation creates active membership.");
  invitedUsers.push(invited[0].user_id);
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
      .data!.length === 5,
    "Successful saves and administration append safe audit events.",
  );
  // Exercise actual Stage 3 transactions; synthetic files only, no model/sandbox claim.
  assert(
    (
      await post(adminCookie, current.version, {
        ...base,
        type: "next",
        label: "Pipeline integration",
      })
    ).status === 200,
  );
  let live = await read(adminCookie);
  const nextBatch = live.vacancies[0].batches.at(-1);
  assert(
    (
      await post(adminCookie, live.version, {
        vacancyId: base.vacancyId,
        batchId: nextBatch.id,
        type: "publish",
      })
    ).status === 200,
  );
  live = await read(adminCookie);
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf
    .addPage()
    .drawText("Fictional restoration fixture 1", { font, x: 30, y: 700 });
  const originalBytes = Buffer.from(await pdf.save());
  const documentId = randomUUID(),
    appKey = "CV-" + randomUUID();
  const reserveArgs = {
    p_workspace: workspaceId,
    p_actor: admin.id,
    p_expected: live.version,
    p_vacancy: base.vacancyId,
    p_batch: nextBatch.id,
    p_document: documentId,
    p_application: appKey,
    p_filename: "Fictional.pdf",
    p_size: originalBytes.length,
    p_type: "pdf",
  };
  assert(
    (await reviewer.client.rpc("reserve_document", reserveArgs)).error,
    "Browser cannot reserve via privileged RPC.",
  );
  const reserved = await db.rpc("reserve_document", reserveArgs);
  assert(
    !reserved.error && reserved.data,
    "Reservation transaction failed: " +
      reserved.error?.code +
      " " +
      reserved.error?.message,
  );
  assert(
    (
      await db.rpc("reserve_document", {
        ...reserveArgs,
        p_document: randomUUID(),
        p_application: "CV-" + randomUUID(),
      })
    ).data === false,
    "Stale reservation must conflict.",
  );
  const { data: scope, error: scopeError } = await db.storage
    .from("cv-originals")
    .createSignedUploadUrl(`${workspaceId}/${documentId}`, { upsert: false });
  assert(!scopeError && scope);
  assert(
    (
      await fetch(scope.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: originalBytes,
      })
    ).ok,
    "Scoped private upload failed.",
  );
  assert(
    (
      await outsider.client.storage
        .from("cv-originals")
        .createSignedUrl(`${workspaceId}/${documentId}`, 60)
    ).error,
    "Outsider cannot download original.",
  );
  const enqueue = await db.rpc("enqueue_document", {
    p_workspace: workspaceId,
    p_actor: admin.id,
    p_document: documentId,
    p_hash: hash(originalBytes),
    p_config: "test-v1",
    p_allowance: 100,
  });
  assert(
    !enqueue.error,
    "Enqueue failed: " + enqueue.error?.code + " " + enqueue.error?.message,
  );
  const q = await db.rpc("read_document_queue");
  assert(!q.error && q.data.length > 0, "Private pgmq read failed.");
  const document = (
    await db.from("documents").select("*").eq("id", documentId).single()
  ).data!;
  assert(document.processing_config === "test-v1", "Enqueue must persist the exact processing configuration.");
  assert(
    (await db.rpc("document_attempt", { p_document: documentId })).data ===
      true,
  );
  const payload: Workspace = (
    await db
      .from("synthetic_workspaces")
      .select("payload")
      .eq("workspace_id", workspaceId)
      .single()
  ).data!.payload;
  const pipelineBatch = payload.vacancies[0].batches.at(-1)!;
  const pipelineApp = pipelineBatch.applications.find((a) => a.id === appKey)!;
  const result = {
    ...pipelineApp,
    state: "ready",
    blocks: [
      {
        id: "P1_B1",
        locator: "Page 1",
        text: "Fictional CRM evidence",
        assessmentText: "Fictional CRM evidence",
        documentVersion: 1,
        inputMethod: "parsed",
      },
    ],
    assessments: Object.fromEntries(
      pipelineBatch.rubric.map((c) => [
        c.id,
        {
          category: "UNCLEAR",
          initial: "UNCLEAR",
          evidence: [],
          rationale: "Human review required",
          flagged: true,
          checked: false,
          reason: "",
        },
      ]),
    ),
  };
  const completeArgs = {
    p_document: documentId,
    p_key: document.processing_key,
    p_result: result,
    p_outputs: [null, null],
    p_usage: [],
    p_error: null,
  };
  assert(
    (await db.rpc("complete_document", { ...completeArgs, p_key: null }))
      .data === false,
    "Missing processing key cannot commit.",
  );
  // Simulate a worker dying after the third reservation and subsequent redelivery.
  await db.from("documents").update({ attempts: 3 }).eq("id", documentId);
  assert(
    (await db.rpc("document_attempt", { p_document: documentId })).data ===
      false,
    "Fourth processing attempt must be refused.",
  );
  assert(
    (
      await db.rpc("complete_document", {
        ...completeArgs,
        p_result: null,
        p_error: "PROCESSING_UNAVAILABLE",
      })
    ).data === true,
    "Exhausted redelivery must become human attention.",
  );
  assert(
    (await db.from("documents").select("status").eq("id", documentId).single())
      .data?.status === "attention",
    "Exhausted worker cannot leave document queued forever.",
  );
  assert(
    (
      await db.rpc("retry_document", {
        p_workspace: workspaceId,
        p_actor: admin.id,
        p_document: documentId,
        p_config: "test-v2",
      })
    ).data === true,
    "Explicit retry should recover attention state.",
  );
  assert(
    (await db.rpc("document_attempt", { p_document: documentId })).data ===
      true,
  );
  const retried = (await db.from("documents").select("processing_key,processing_config").eq("id", documentId).single()).data!;
  assert(retried.processing_config === "test-v2", "Explicit retry pins the new configuration.");
  assert((await db.rpc("complete_document", completeArgs)).data === false, "Previous configuration cannot commit after retry.");
  completeArgs.p_key = retried.processing_key;
  const completion = await db.rpc("complete_document", completeArgs);
  assert(!completion.error && completion.data, "Atomic completion failed.");
  assert(
    (await db.rpc("complete_document", completeArgs)).data === true,
    "Repeated completion must return existing result.",
  );
  assert(
    (
      await db
        .from("assessment_runs")
        .select("id")
        .eq("document_id", documentId)
    ).data!.length === 1,
    "Redelivery cannot create a second run.",
  );
  assert(
    (await db.from("source_blocks").select("id").eq("document_id", documentId))
      .data!.length === 1,
  );
  assert(
    (await read(adminCookie)).vacancies[0].batches
      .at(-1)
      .applications.find((a: { id: string }) => a.id === appKey).confirmed ===
      false,
  );
  const memberArgs = {
    p_workspace: workspaceId,
    p_actor: admin.id,
    p_user: admin.id,
    p_role: "reviewer",
    p_active: true,
  };
  assert(
    (await db.rpc("manage_member", memberArgs)).error,
    "Last administrator cannot be demoted.",
  );
  assert(
    (await reviewer.client.rpc("manage_member", memberArgs)).error,
    "Reviewer cannot manage membership.",
  );
  const budgetKey = "integration-" + randomUUID();
  assert(
    (
      await db.rpc("consume_request_limit", {
        p_key: budgetKey,
        p_limit: 1,
        p_seconds: 60,
      })
    ).data === true,
  );
  assert(
    (
      await db.rpc("consume_request_limit", {
        p_key: budgetKey,
        p_limit: 1,
        p_seconds: 60,
      })
    ).data === false,
  );
  // Second retained object ensures restore checks real object bytes as well as erased content.
  const secondDoc = randomUUID(),
    secondApp = "CV-" + randomUUID();
  pdf
    .addPage()
    .drawText("Fictional restoration fixture 2", { font, x: 30, y: 700 });
  const secondBytes = Buffer.from(await pdf.save());
  const freshVersion = (await read(adminCookie)).version;
  assert(
    (
      await db.rpc("reserve_document", {
        ...reserveArgs,
        p_expected: freshVersion,
        p_document: secondDoc,
        p_application: secondApp,
        p_size: secondBytes.length,
      })
    ).data === true,
  );
  assert(
    !(
      await db.storage
        .from("cv-originals")
        .upload(`${workspaceId}/${secondDoc}`, secondBytes, {
          contentType: "application/pdf",
        })
    ).error,
  );
  assert(
    !(
      await db.rpc("enqueue_document", {
        p_workspace: workspaceId,
        p_actor: admin.id,
        p_document: secondDoc,
        p_hash: hash(secondBytes),
        p_config: "test-v1",
        p_allowance: 100,
      })
    ).error,
  );
  const secondKey = (
    await db
      .from("documents")
      .select("processing_key")
      .eq("id", secondDoc)
      .single()
  ).data!.processing_key;
  assert(
    (
      await db.rpc("complete_document", {
        ...completeArgs,
        p_document: secondDoc,
        p_key: secondKey,
        p_result: { ...result, id: secondApp, runId: secondDoc },
      })
    ).data === true,
  );
  const backupDir = `work/recovery/integration-${workspaceId}`;
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const childEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
    WORKSPACE_ID: workspaceId,
    BOOTSTRAP_ADMIN_USER_ID: admin.id,
    REAL_CV_DATA_ENABLED: "false",
  };
  execFileSync("node", ["--import", "tsx", "scripts/backup.ts", backupDir], {
    env: childEnv,
    stdio: "pipe",
  });
  assert(
    JSON.parse(await readFile(backupDir + "/backup.json", "utf8")).objects
      .length === 2,
    "Backup includes database and both originals.",
  );
  const backup = structuredClone(
    (
      await db
        .from("synthetic_workspaces")
        .select("payload")
        .eq("workspace_id", workspaceId)
        .single()
    ).data!.payload,
  );
  const deletion = await db.rpc("delete_application_content", {
    p_workspace: workspaceId,
    p_actor: admin.id,
    p_application: appKey,
  });
  assert(!deletion.error, "Authorised deletion failed.");
  assert(
    (await db.rpc("complete_document", completeArgs)).data === false,
    "Deleted document cannot commit stale work.",
  );
  assert(
    (
      await db
        .from("assessment_runs")
        .select("id")
        .eq("document_id", documentId)
    ).data!.length === 0,
  );
  assert(
    (await db.from("source_blocks").select("id").eq("document_id", documentId))
      .data!.length === 0,
  );
  assert(
    (
      await db
        .from("synthetic_workspaces")
        .update({ payload: backup })
        .eq("workspace_id", workspaceId)
    ).error,
    "Restore cannot resurrect deleted content.",
  );
  assert(
    (
      await db
        .from("documents")
        .update({ deletion_state: "retained" })
        .eq("id", documentId)
    ).error,
    "Restored original cannot bypass deletion ledger.",
  );
  const entity = (
    await db.rpc("record_id", { p_workspace: workspaceId, p_key: appKey })
  ).data;
  assert(
    !(
      await db.rpc("finish_deletion", {
        p_workspace: workspaceId,
        p_entity: entity,
      })
    ).error,
  );
  const currentLedger = (
    await db.from("deletion_ledger").select("*").eq("workspace_id", workspaceId)
  ).data!;
  await writeFile(
    backupDir + "/current-deletions.json",
    JSON.stringify({
      workspaceId,
      at: new Date().toISOString(),
      ledger: currentLedger,
    }),
    { mode: 0o600 },
  );
  assert(
    !(
      await db.storage
        .from("cv-originals")
        .remove([`${workspaceId}/${documentId}`, `${workspaceId}/${secondDoc}`])
    ).error,
  );
  await cleanupWorkspace(workspaceId);
  execFileSync(
    "node",
    [
      "--import",
      "tsx",
      "scripts/restore.ts",
      backupDir,
      backupDir + "/current-deletions.json",
    ],
    {
      env: { ...childEnv, RESTORE_SYNTHETIC_CONFIRM: "EMPTY TARGET" },
      stdio: "pipe",
    },
  );
  const restoredFile = (
    await db.storage
      .from("cv-originals")
      .download(`${workspaceId}/${secondDoc}`)
  ).data;
  assert(
    restoredFile &&
      hash(Buffer.from(await restoredFile.arrayBuffer())) === hash(secondBytes),
    "Restored storage hash must match.",
  );
  assert(
    (
      await db.storage
        .from("cv-originals")
        .exists(`${workspaceId}/${documentId}`)
    ).data === false,
    "Deleted original must not return.",
  );
  assert(
    (await db.from("documents").select("id").eq("workspace_id", workspaceId))
      .data!.length === 1,
    "Restore filters deleted document row.",
  );
  const restored = (
    await db
      .from("synthetic_workspaces")
      .select("payload")
      .eq("workspace_id", workspaceId)
      .single()
  ).data!.payload;
  assert(
    restored.vacancies[0].batches
      .at(-1)
      .applications.find((a: { id: string }) => a.id === appKey).blocks
      .length === 0,
    "Restore reapplies deletion to aggregate.",
  );
  assert(
    (
      await db
        .from("workspaces")
        .select("settings")
        .eq("id", workspaceId)
        .single()
    ).data!.settings.paused === true,
    "Restore stays paused.",
  );
  assert(
    !(
      await db.storage
        .from("cv-originals")
        .remove([`${workspaceId}/${secondDoc}`])
    ).error,
  );
  console.log(
    "PASS: actual private object/database backup, empty-target restore, row counts and rehashed originals; current deletion ledger prevents resurrection; restored intake remains paused.",
  );
  console.log(
    "PASS: normalized projection, private pgmq, reservation concurrency, atomic result/redelivery, source records, last-admin protection, rate limits, deletion during processing and restore resurrection denial.",
  );
  console.log(
    "PASS: local Supabase migrations, MFA, membership, outsider/removal denial, role escalation denial, direct RPC/Data API denial, private bucket, forged upload denial, second-reviewer resume, stale/concurrent saves, immutable SQL snapshot, audit append.",
  );
} finally {
  server?.kill("SIGTERM");
  if (workspaceId) {
    assert(/^[0-9a-f-]{36}$/.test(workspaceId));
    await cleanupWorkspace(workspaceId);
  }
  for (const u of users) await db.auth.admin.deleteUser(u.id);
  for (const id of invitedUsers) await db.auth.admin.deleteUser(id);
}
