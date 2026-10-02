// Destructive integration fixture: local Supabase only, one disposable workspace.
// Child output and CLI credentials stay in memory; only fixed PASS/FAIL text is printed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { seed, samples } from "../fixtures/synthetic/seed";
import { hash } from "../lib/pipeline/contracts";
import { recordId } from "../lib/recovery";
import { applyAction, type Action, type Workspace } from "../lib/workflow";

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert(
  new URL(status.API_URL).hostname === "127.0.0.1" ||
    new URL(status.API_URL).hostname === "localhost",
  "Recovery integration requires local Supabase.",
);

const db = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const workspaceId = randomUUID();
const scratch = resolve(`work/recovery-integration-${workspaceId}`);
const users: string[] = [];
const objectKeys: string[] = [];
let workspaceCreated = false;
let phase = "setup";
let safeDbCode = "";

function failIf(error: unknown, message: string) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9]{5}$/.test(code))
      safeDbCode = code;
  }
  assert(!error, message);
}

function changedPaths(a: unknown, b: unknown, path = "snapshot", changed: string[] = []) {
  if (Object.is(a, b)) return changed;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    changed.push(path);
    return changed;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      changed.push(path);
      return changed;
    }
    a.forEach((value, index) => changedPaths(value, b[index], `${path}.${index}`, changed));
    return changed;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!(key in a) || !(key in b)) changed.push(`${path}.${key}`);
    else changedPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`, changed);
  }
  return changed;
}

async function createUser(label: string) {
  const { data, error } = await db.auth.admin.createUser({
    email: `${label}-${randomUUID()}@example.invalid`,
    email_confirm: true,
  });
  failIf(error, "Synthetic auth user setup failed.");
  assert(data.user, "Synthetic auth user setup failed.");
  users.push(data.user.id);
  return data.user.id;
}

async function saveAction(
  state: Workspace,
  action: Action,
  actor: string,
  operation = action.type,
) {
  const uuidBackedSamples = (rubric: Parameters<typeof samples>[0], version: number) =>
    samples(rubric, version).map((app) => ({ ...app, runId: randomUUID() }));
  const next = applyAction(state, action, actor, randomUUID, uuidBackedSamples);
  const { data, error } = await db.rpc("save_synthetic_workspace", {
    p_workspace: workspaceId,
    p_actor: actor,
    p_expected: state.version,
    p_payload: next,
    p_operation: operation,
  });
  failIf(error, "Synthetic workflow save failed.");
  assert(data === true, "Synthetic workflow save conflicted.");
  return next;
}

async function deleteWorkspace() {
  if (!workspaceCreated) return;
  // This direct SQL cleanup is scoped to this random UUID and never includes another workspace.
  const sql = `delete from pgmq.q_shortlist_documents where message->>'document_id' in (select id::text from public.documents where workspace_id='${workspaceId}'); delete from public.application_reviews where application_id in (select a.id from public.applications a join public.batches b on b.id=a.batch_id join public.vacancies v on v.id=b.vacancy_id where v.workspace_id='${workspaceId}'); delete from public.assessment_runs where application_id in (select a.id from public.applications a join public.batches b on b.id=a.batch_id join public.vacancies v on v.id=b.vacancy_id where v.workspace_id='${workspaceId}'); delete from public.source_blocks where document_id in (select id from public.documents where workspace_id='${workspaceId}'); delete from public.documents where workspace_id='${workspaceId}'; delete from public.applications where batch_id in (select b.id from public.batches b join public.vacancies v on v.id=b.vacancy_id where v.workspace_id='${workspaceId}'); delete from public.batches where vacancy_id in (select id from public.vacancies where workspace_id='${workspaceId}'); delete from public.vacancies where workspace_id='${workspaceId}'; delete from public.processing_allowances where workspace_id='${workspaceId}'; delete from public.deletion_ledger where workspace_id='${workspaceId}'; delete from public.audit_events where workspace_id='${workspaceId}'; delete from public.synthetic_workspaces where workspace_id='${workspaceId}'; delete from public.workspace_members where workspace_id='${workspaceId}'; delete from public.workspaces where id='${workspaceId}';`;
  execFileSync(
    "docker",
    ["exec", "supabase_db_shortlist-local", "psql", "-U", "postgres", "-d", "postgres", "-c", sql],
    { stdio: "ignore" },
  );
  workspaceCreated = false;
}

async function child(script: string, args: string[], env: NodeJS.ProcessEnv) {
  try {
    return execFileSync("node", ["--import", "tsx", script, ...args], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const output = String((error as { stderr?: Buffer | string }).stderr ?? "");
    const known: Array<[string, string]> = [
      ["RECOVERY_QUERY_INCOMPLETE", "pagination_query"],
      ["RECOVERY_CHANGED_DURING_EXPORT", "pagination_changed"],
      ["RECOVERY_ROW_INTEGRITY", "pagination_integrity"],
      ["RECOVERY_QUERY_TRUNCATED", "pagination_truncated"],
      ["Reserved object status unavailable", "reservation_probe"],
      ["Original object unavailable", "original_object_missing"],
      ["Backup query failed", "backup_query"],
      ["Workspace changed during backup", "backup_changed"],
    ];
    safeDbCode = known.find(([needle]) => output.includes(needle))?.[1] ?? "cli_error";
    throw new Error("Recovery CLI failed; detailed output withheld.");
  }
}

async function main() {
  phase = "create synthetic users";
  await mkdir(scratch, { recursive: true, mode: 0o700 });
  const sourceAdmin = await createUser("recovery-source-admin");
  const sourceReviewer = await createUser("recovery-source-reviewer");
  const restoreAdmin = await createUser("recovery-new-admin");

  const { error: workspaceError } = await db.from("workspaces").insert({
    id: workspaceId,
    name: "Disposable recovery integration",
    settings: { paused: false, retentionDays: null, incidentOwner: "" },
  });
  failIf(workspaceError, "Disposable workspace setup failed.");
  workspaceCreated = true;
  const { error: membershipError } = await db.from("workspace_members").insert([
    { workspace_id: workspaceId, user_id: sourceAdmin, role: "administrator" },
    { workspace_id: workspaceId, user_id: sourceReviewer, role: "reviewer" },
  ]);
  failIf(membershipError, "Disposable membership setup failed.");

  let state = seed();
  const { error: stateError } = await db.from("synthetic_workspaces").insert({
    workspace_id: workspaceId,
    version: state.version,
    payload: state,
  });
  failIf(stateError, "Disposable synthetic state setup failed.");

  phase = "build frozen workflow history";
  state = await saveAction(state, { type: "publish", vacancyId: "customer-success", batchId: "first-batch" }, sourceAdmin);
  state = await saveAction(state, { type: "samples", vacancyId: "customer-success", batchId: "first-batch" }, sourceAdmin);
  state = await saveAction(state, { type: "close", vacancyId: "customer-success", batchId: "first-batch" }, sourceAdmin);
  for (const app of state.vacancies[0].batches[0].applications) {
    const current = state.vacancies[0].batches[0].applications.find((item) => item.id === app.id)!;
    const decisions = Object.fromEntries(
      Object.entries(current.assessments).map(([criterionId, assessment]) => {
        const category = assessment.category === "UNCLEAR" ? "FULL" : assessment.category;
        const evidence = assessment.evidence.length
          ? assessment.evidence
          : category === "NOT_EVIDENCED"
            ? []
            : [current.blocks[0].id];
        return [criterionId, {
          category,
          evidence,
          checked: true,
          reason: assessment.category === "UNCLEAR" ? "Synthetic reviewer resolved unclear practice evidence." : "",
        }];
      }),
    );
    state = await saveAction(state, {
      type: "review",
      vacancyId: "customer-success",
      batchId: "first-batch",
      applicationId: current.id,
      runId: current.runId,
      documentVersion: current.documentVersion,
      decisions,
      sourceChecked: true,
      confirm: true,
      attest: true,
    }, sourceReviewer);
  }
  state = await saveAction(state, {
    type: "selection",
    vacancyId: "customer-success",
    batchId: "first-batch",
    selected: [],
    reason: "No fictional candidate selected in the recovery fixture.",
    tieReason: "",
    exceptions: {},
  }, sourceAdmin);
  state = await saveAction(state, { type: "finalise", vacancyId: "customer-success", batchId: "first-batch" }, sourceAdmin);
  const frozenSnapshot = structuredClone(state.vacancies[0].batches[0].snapshot);
  assert(frozenSnapshot?.applications.some((app) => app.reviewedBy === sourceReviewer));

  state = await saveAction(state, {
    type: "next",
    vacancyId: "customer-success",
    batchId: "first-batch",
    label: "Recovery intake",
  }, sourceAdmin);
  const intake = state.vacancies[0].batches[1];
  state = await saveAction(state, { type: "publish", vacancyId: "customer-success", batchId: intake.id }, sourceAdmin);
  state = await saveAction(state, { type: "samples", vacancyId: "customer-success", batchId: intake.id }, sourceAdmin);

  phase = "create queue and reserved fixtures";
  const queuedDocumentId = randomUUID();
  const queuedApplicationKey = `Q-${randomUUID()}`;
  const reservedDocumentId = randomUUID();
  const deletedApplicationKey = `R-${randomUUID()}`;
  const original = Buffer.from("%PDF-1.4\nSynthetic recovery-only document\n%%EOF\n");
  const reserve = async (documentId: string, applicationKey: string, bytes: Buffer) => {
    const current = (await db.from("synthetic_workspaces").select("version,payload").eq("workspace_id", workspaceId).single()).data!;
    const { data, error } = await db.rpc("reserve_document", {
      p_workspace: workspaceId,
      p_actor: sourceAdmin,
      p_expected: current.version,
      p_vacancy: "customer-success",
      p_batch: intake.id,
      p_document: documentId,
      p_application: applicationKey,
      p_filename: "fictional.pdf",
      p_size: bytes.length,
      p_type: "pdf",
    });
    failIf(error, "Synthetic document reservation failed.");
    assert(data === true, "Synthetic document reservation conflicted.");
    return current.payload as Workspace;
  };
  phase = "reserve queued document";
  await reserve(queuedDocumentId, queuedApplicationKey, original);
  const queuedPath = `${workspaceId}/${queuedDocumentId}`;
  objectKeys.push(queuedPath);
  phase = "upload queued document";
  const { error: uploadError } = await db.storage.from("cv-originals").upload(queuedPath, original, { contentType: "application/pdf" });
  failIf(uploadError, "Synthetic document upload failed.");
  phase = "enqueue queued document";
  const { error: enqueueError } = await db.rpc("enqueue_document", {
    p_workspace: workspaceId,
    p_actor: sourceAdmin,
    p_document: queuedDocumentId,
    p_hash: hash(original),
    p_config: "recovery-integration-v1",
    p_allowance: 1000,
  });
  failIf(enqueueError, "Synthetic queue setup failed.");

  // Add a real reviewed object/run/review so recovery must clear Auth attribution.
  const reviewedApplicationKey = "A101";
  const reviewedApplicationId = recordId(workspaceId, reviewedApplicationKey);
  const reviewedDocumentId = randomUUID();
  const reviewedPath = `${workspaceId}/${reviewedDocumentId}`;
  const reviewedBytes = Buffer.from("%PDF-1.4\nSynthetic reviewed document\n%%EOF\n");
  objectKeys.push(reviewedPath);
  const reviewedRunId = frozenSnapshot!.applications.find((app) => app.id === reviewedApplicationKey)!.runId;
  phase = "upload reviewed document";
  const { error: reviewedUploadError } = await db.storage.from("cv-originals").upload(reviewedPath, reviewedBytes, { contentType: "application/pdf" });
  failIf(reviewedUploadError, "Synthetic reviewed object setup failed.");
  const { error: documentError } = await db.from("documents").insert({
    id: reviewedDocumentId,
    application_id: reviewedApplicationId,
    workspace_id: workspaceId,
    vacancy_key: "customer-success",
    batch_key: "first-batch",
    application_key: reviewedApplicationKey,
    private_object_key: reviewedPath,
    original_filename: "fictional-reviewed.pdf",
    size: reviewedBytes.length,
    type: "pdf",
    hash: hash(reviewedBytes),
    status: "complete",
    processing_key: `fixture-${reviewedRunId}`,
    processing_config: "recovery-integration-v1",
  });
  failIf(documentError, "Synthetic reviewed document setup failed.");
  phase = "insert reviewed run";
  const { error: runError } = await db.from("assessment_runs").insert({
    id: reviewedRunId,
    processing_key: `fixture-${reviewedRunId}`,
    application_id: reviewedApplicationId,
    document_id: reviewedDocumentId,
    rubric_version: 1,
    config_version: "recovery-integration-v1",
    merged_suggestions: {},
    usage: [],
    state: "complete",
  });
  failIf(runError, "Synthetic review run setup failed.");
  phase = "insert normalized review";
  const { error: reviewError } = await db.from("application_reviews").insert({
    application_id: reviewedApplicationId,
    assessment_run_id: reviewedRunId,
    effective_categories: {},
    evidence_references: {},
    essential_checks: {},
    reasons: {},
    reviewed_by: sourceReviewer,
    reviewed_at: new Date().toISOString(),
    version: state.version,
  });
  failIf(reviewError, "Synthetic review attribution setup failed.");

  // The deleted reservation belongs to a current intake candidate and has no uploaded object.
  const latestState = (await db.from("synthetic_workspaces").select("payload").eq("workspace_id", workspaceId).single()).data!.payload as Workspace;
  state = latestState;
  phase = "reserve no-object document";
  await reserve(reservedDocumentId, deletedApplicationKey, original);

  phase = "create large deletion ledger";
  const dummyDeletions = Array.from({ length: 1004 }, () => randomUUID());
  const deletedApplicationId = recordId(workspaceId, deletedApplicationKey);
  const { error: ledgerError } = await db.from("deletion_ledger").insert(
    [
      ...dummyDeletions.map((entity_id) => ({ workspace_id: workspaceId, entity_id })),
      { workspace_id: workspaceId, entity_id: deletedApplicationId },
    ],
  );
  failIf(ledgerError, "Synthetic deletion ledger setup failed.");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    WORKSPACE_ID: workspaceId,
    BOOTSTRAP_ADMIN_USER_ID: restoreAdmin,
    REAL_CV_DATA_ENABLED: "false",
  };
  phase = "run backup";
  const backupOutput = await child("scripts/backup.ts", [scratch], env);
  assert(backupOutput.includes("Synthetic database/object backup verified"));
  const backup = JSON.parse(await readFile(join(scratch, "backup.json"), "utf8"));
  const archivedSnapshot = backup.state.payload.vacancies[0].batches[0].snapshot;
  assert(archivedSnapshot.applications.some((app: { reviewedBy?: string }) => app.reviewedBy === sourceReviewer));
  const backedReserved = backup.documents.find((row: { id: string }) => row.id === reservedDocumentId);
  assert(backedReserved, "Backup omitted the unuploaded reservation row.");
  assert(backedReserved.status === "reserved" && backedReserved.hash === null);
  assert(!backup.objects.some((object: { documentId: string }) => object.documentId === reservedDocumentId));
  assert(backup.objects.some((object: { documentId: string }) => object.documentId === queuedDocumentId));
  assert(backup.counts.ledger === 1005, "Backup ledger count is incorrect.");
  assert(backup.reviews.some((review: { application_id: string; reviewed_by: string }) => review.application_id === reviewedApplicationId && review.reviewed_by === sourceReviewer));

  const currentLedgerPath = join(scratch, "current-deletions.json");
  phase = "export current ledger";
  await child("scripts/export-ledger.ts", [currentLedgerPath], env);
  const currentLedger = JSON.parse(await readFile(currentLedgerPath, "utf8"));
  assert(currentLedger.count === 1005, "Ledger export omitted rows beyond the first page.");
  assert(currentLedger.policyCount === currentLedger.policies.length, "Policy export count differs.");
  assert(currentLedger.holdCount === currentLedger.holds.length, "Hold export count differs.");
  assert(Number.isSafeInteger(currentLedger.lifecycleRevision), "Lifecycle revision is missing.");

  // Remove source identity and source workspace before restoring with a different administrator.
  phase = "remove source workspace and reviewer";
  await deleteWorkspace();
  for (const key of objectKeys) {
    await db.storage.from("cv-originals").remove([key]);
  }
  const { error: reviewerDeleteError } = await db.auth.admin.deleteUser(sourceReviewer);
  failIf(reviewerDeleteError, "Source reviewer removal failed.");
  const { error: sourceAdminDeleteError } = await db.auth.admin.deleteUser(sourceAdmin);
  failIf(sourceAdminDeleteError, "Source administrator removal failed.");
  assert(!(await db.auth.admin.getUserById(sourceReviewer)).data.user);

  phase = "restore into fresh administrator workspace";
  const restoreOutput = await child("scripts/restore.ts", [scratch, currentLedgerPath], {
    ...env,
    RESTORE_SYNTHETIC_CONFIRM: "EMPTY TARGET",
  });
  assert(restoreOutput.includes("Synthetic restore complete and paused"));
  workspaceCreated = true;

  phase = "verify restored workspace and attribution";
  phase = "verify paused restore target";
  const { data: restoredWorkspace, error: workspaceReadError } = await db
    .from("workspaces")
    .select("settings")
    .eq("id", workspaceId)
    .single();
  failIf(workspaceReadError, "Restored workspace status unavailable.");
  assert(restoredWorkspace);
  assert(restoredWorkspace.settings.paused === true, "Restored workspace must remain paused.");
  phase = "verify replacement administrator membership";
  assert((await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("user_id", restoreAdmin)).data?.length === 1);
  assert((await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("user_id", sourceAdmin)).data?.length === 0);

  const { data: restoredStateRow, error: restoredStateError } = await db
    .from("synthetic_workspaces")
    .select("version,payload")
    .eq("workspace_id", workspaceId)
    .single();
  failIf(restoredStateError, "Restored state unavailable.");
  assert(restoredStateRow);
  const restoredState = restoredStateRow.payload as Workspace;
  const restoredFrozen = restoredState.vacancies[0].batches[0];
  phase = "verify frozen snapshot unchanged";
  const snapshotDiff = changedPaths(restoredFrozen.snapshot, archivedSnapshot);
  if (snapshotDiff.length) safeDbCode = `changed_${snapshotDiff.slice(0, 6).join(",")}`;
  assert.deepStrictEqual(restoredFrozen.snapshot, archivedSnapshot, "Frozen historical review snapshot changed.");
  phase = "verify current attribution cleared";
  assert(restoredFrozen.applications.every((app) => !app.reviewedBy), "Current aggregate retained deleted Auth attribution.");
  phase = "verify deletion reapplication";
  const removed = restoredState.vacancies[0].batches[1].applications.find((app) => app.id === deletedApplicationKey);
  assert(removed?.state === "disposed" && removed.name === "" && removed.blocks.length === 0, "Deleted applicant content was resurrected.");

  const { data: restoredReview, error: restoredReviewError } = await db
    .from("application_reviews")
    .select("reviewed_by")
    .eq("application_id", reviewedApplicationId)
    .single();
  failIf(restoredReviewError, "Restored normalized review unavailable.");
  assert(restoredReview);
  assert(restoredReview.reviewed_by === null, "Normalized review retained deleted source attribution.");
  const { data: restoredReserved } = await db.from("documents").select("id").eq("id", reservedDocumentId).maybeSingle();
  assert(!restoredReserved, "Deleted applicant reservation was restored.");
  const { data: reservedObject } = await db.storage.from("cv-originals").exists(`${workspaceId}/${reservedDocumentId}`);
  assert(reservedObject === false, "Deleted reservation object was restored.");

  phase = "verify queue recovery and next save";
  const { data: restoredQueued } = await db.from("documents").select("status,hash,processing_key,processing_config").eq("id", queuedDocumentId).single();
  assert(restoredQueued);
  assert(restoredQueued.status === "queued" && restoredQueued.hash === hash(original));
  assert(restoredQueued.processing_key && restoredQueued.processing_config === "recovery-integration-v1");
  const queuedCount = Number(execFileSync(
    "docker",
    ["exec", "supabase_db_shortlist-local", "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", `select count(*) from pgmq.q_shortlist_documents where message->>'document_id'='${queuedDocumentId}';`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim());
  assert(queuedCount === 1, "Restored queued document was not re-enqueued exactly once.");

  const nextBatch = restoredState.vacancies[0].batches[1];
  const nextState = applyAction(restoredState, {
    type: "dispose",
    vacancyId: "customer-success",
    batchId: nextBatch.id,
    applicationId: nextBatch.applications[0].id,
    disposition: "duplicate",
    reason: "Recovery integration only.",
  }, restoreAdmin, randomUUID, samples);
  const { data: nextSave, error: nextSaveError } = await db.rpc("save_synthetic_workspace", {
    p_workspace: workspaceId,
    p_actor: restoreAdmin,
    p_expected: restoredStateRow.version,
    p_payload: nextState,
    p_operation: "dispose",
  });
  failIf(nextSaveError, "Fresh administrator could not save after restore.");
  assert(nextSave === true, "Fresh administrator save conflicted after restore.");
  assert((await db.from("deletion_ledger").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId)).count === 1005);
  process.stdout.write("PASS: exact 1005-row deletion export, reserved-row backup, reviewer-safe fresh-admin restore, frozen history, paused queue recovery, deletion filtering and post-restore save.\n");
}

try {
  await main();
} catch {
  process.stderr.write(`Recovery integration failed during ${phase}${safeDbCode ? ` (database code ${safeDbCode})` : ""}; detailed output withheld.\n`);
  process.exitCode = 1;
} finally {
  try {
    await deleteWorkspace();
    for (const key of objectKeys) await db.storage.from("cv-originals").remove([key]);
    for (const id of users) {
      const { data } = await db.auth.admin.getUserById(id);
      if (data.user) await db.auth.admin.deleteUser(id);
    }
    await rm(scratch, { recursive: true, force: true });
  } catch {
    process.stderr.write("Disposable recovery fixture cleanup needs inspection.\n");
    process.exitCode = 1;
  }
}
