// Opt-in hosted acceptance with disposable fictional identity and in-memory MFA.
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import { publicState } from "../lib/workflow";
type View = ReturnType<typeof publicState>;
import { sampleRubric } from "../fixtures/synthetic/seed";
import { totp } from "../scripts/local-authenticator";
if (process.env.HOSTED_SYNTHETIC_CONFIRM !== "FICTIONAL ONLY")
  throw new Error("Explicit fictional-only confirmation required.");
if (!process.argv[2])
  throw new Error("Private hosted environment file required.");
process.loadEnvFile(process.argv[2]);
const origin = process.env.APP_URL!;
const target = new URL(origin);
if (
  target.protocol !== "https:" ||
  target.origin !== origin ||
  process.env.PERSISTENCE_MODE !== "supabase-synthetic" ||
  process.env.AI_ENABLED !== "true" ||
  !process.env.AI_MODEL_ID ||
  process.env.REAL_CV_DATA_ENABLED === "true" ||
  process.env.LOCAL_AUTH_BYPASS === "true"
)
  throw new Error("Isolated hosted synthetic configuration required.");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const owner = {
  email: `shortlist-qa-${crypto.randomUUID()}@example.invalid`,
  password: crypto.randomUUID() + crypto.randomUUID(),
  secret: "",
  actor: "",
  workspaceId: process.env.WORKSPACE_ID!,
};
let stage = "create-test-account";
const testApplications: string[] = [];
let testVacancyId = "";
const browser = await chromium.launch();
const context = await browser.newContext(),
  page = await context.newPage();
const consoleErrors: string[] = [];
const diagnostics: string[] = [];
page.on("pageerror", (error) => {
  consoleErrors.push("page-error");
  diagnostics.push(`pageerror:${error.name}`);
});
page.on("console", (message) => {
  if (message.type() === "error") diagnostics.push(`console:${message.type()}`);
});
page.on("requestfailed", (request) => {
  diagnostics.push(`request-failed:${new URL(request.url()).pathname}`);
});
page.on("response", (response) => {
  const pathname = new URL(response.url()).pathname;
  if (response.status() >= 400 && pathname.startsWith("/api/"))
    diagnostics.push(`api:${response.status()}:${pathname}`);
  if (pathname === "/api/workspace")
    void response
      .json()
      .then((body) =>
        diagnostics.push(
          `workspace-keys:${Object.keys(body).sort().join("|")}`,
        ),
      )
      .catch(() => diagnostics.push("workspace-invalid-json"));
});
await mkdir("work/live-fixtures", { recursive: true });
const passages = [
  "Owned a portfolio of 35 customer accounts and renewals.",
  "Led customer onboarding sessions and adoption plans.",
  "Built monthly reports, interpreted trends and recommended retention actions.",
  "Used Salesforce CRM to manage account activity and renewals.",
  "Worked directly with customers for three years in account support.",
  "Completed customer success training on onboarding and retention.",
];
const pdf = await PDFDocument.create(),
  font = await pdf.embedFont(StandardFonts.Helvetica),
  pdfPage = pdf.addPage();
passages.forEach((text, i) =>
  pdfPage.drawText(text, { x: 35, y: 740 - i * 35, font, size: 10 }),
);
await writeFile("work/live-fixtures/fictional.pdf", await pdf.save());
await writeFile(
  "work/live-fixtures/fictional.docx",
  await Packer.toBuffer(
    new Document({
      sections: [{ children: passages.map((t) => new Paragraph(t)) }],
    }),
  ),
);
const publicPilot = process.env.HOSTED_EXPECT_TEMPORARY_PUBLIC === "true";
if (publicPilot && (process.env.TEMP_PUBLIC_ACCESS !== "true" ||
    Date.parse(process.env.TEMP_PUBLIC_ACCESS_UNTIL ?? "") <= Date.now()))
  throw new Error("Active temporary public pilot configuration required.");
try {
  const created = await db.auth.admin.createUser({
    email: owner.email,
    password: owner.password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error("HOSTED_CREATE_TEST_USER_FAILED");
  owner.actor = created.data.user.id;

  stage = "test-member-and-mfa";
  const member = await db.from("workspace_members").insert({
    workspace_id: owner.workspaceId,
    user_id: owner.actor,
    role: "administrator",
    active: true,
  });
  if (member.error) throw new Error("HOSTED_TEST_MEMBERSHIP_FAILED");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  if (
    (
      await client.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      })
    ).error
  )
    throw new Error("HOSTED_TEST_LOGIN_FAILED");
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error || !enrolled.data)
    throw new Error("HOSTED_TEST_ENROLL_FAILED");
  owner.secret = enrolled.data.totp.secret;
  if (
    (
      await client.auth.mfa.challengeAndVerify({
        factorId: enrolled.data.id,
        code: totp(owner.secret),
      })
    ).error
  )
    throw new Error("HOSTED_TEST_FACTOR_FAILED");
  console.log("Hosted disposable test MFA enrolled and verified.");
  stage = "browser-mfa";
  stage = "browser-mfa-anonymous-readiness";
  const anonymousReadiness = await context.request.get(
    origin + "/api/readiness",
  );
  expect([401, 403]).toContain(anonymousReadiness.status());
  if (publicPilot) {
    await page.goto(origin + "/login");
    await expect(page).toHaveURL(origin + "/");
  } else {
    stage = "browser-mfa-open-login";
    await page.goto(origin + "/login");
    stage = "browser-mfa-fill-login";
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await page.getByLabel("Email", { exact: true }).fill(owner.email);
    await page.getByLabel("Password", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    stage = "browser-mfa-fill-code";
    await page
      .getByLabel("Six digit authenticator code")
      .fill(totp(owner.secret));
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await page.waitForURL(/\/(?:vacancies)?$/, { timeout: 30000 });
  }
  stage = "browser-mfa-open-vacancies";
  stage = "browser-mfa-check-vacancies-url";
  await expect(page).toHaveURL(/\/(?:vacancies)?$/);
  stage = "browser-mfa-check-vacancies";
  await expect(
    page.getByRole("heading", { name: "Vacancies", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  const privateReadiness = await context.request.get(origin + "/api/readiness");
  if (publicPilot) {
    expect(privateReadiness.status()).toBe(403);
    for (const path of ["/api/administration", "/api/retention"])
      expect((await context.request.get(origin + path)).status()).toBe(403);
    console.log("Temporary fictional public pilot: administration denied; browser MFA not assessed.");
  } else {
    expect(privateReadiness.status()).toBe(200);
    expect(privateReadiness.headers()["cache-control"]).toBe("private, no-store");
    const readiness = await privateReadiness.json();
    expect(Object.keys(readiness).sort()).toEqual(["checks", "status"]);
    expect(readiness.status).toBe("configuration_ready");
    for (const check of readiness.checks)
      expect(Object.keys(check).sort()).toEqual(["name", "status"]);
  }
  async function state() {
    const r = await page.request.get(origin + "/api/workspace");
    expect(r.status()).toBe(200);
    return r.json() as Promise<View>;
  }
  async function action(action: unknown) {
    const s = await state();
    const r = await page.request.post(origin + "/api/workspace", {
      headers: { origin },
      data: { version: s.version, action },
    });
    expect(r.status()).toBe(200);
    return r.json() as Promise<View>;
  }
  stage = "criteria-and-upload";
  const title = "Fictional hosted acceptance " + Date.now();
  let s = await action({
    type: "create",
    title,
    team: "Fictional QA",
    description:
      "Fictional customer success role for local document acceptance.",
  });
  const v = s.vacancies.at(-1)!,
    b = v.batches[0],
    base = { vacancyId: v.id, batchId: b.id };
  testVacancyId = v.id;
  await action({ ...base, type: "rubric", rubric: sampleRubric });
  await action({ ...base, type: "publish" });
  await page.reload();
  await page
    .getByRole("link", { name: "Vacancies", exact: true })
    .first()
    .click();
  await page
    .locator(".vacancy-row")
    .filter({ hasText: title })
    .getByRole("link", { name: new RegExp(` for ${title}$`) })
    .click();
  await page
    .getByLabel("I confirm these files contain fictional data only.")
    .check();
  for (const file of ["fictional.pdf", "fictional.docx"]) {
    await page
      .getByLabel("Choose fictional CV")
      .setInputFiles("work/live-fixtures/" + file);
    await expect(page.getByLabel("Choose fictional CV")).toBeEnabled({
      timeout: 20000,
    });
    await expect
      .poll(
        async () => {
          const w = await state();
          return w.vacancies.find((x) => x.id === v.id)!.batches[0].applications
            .length;
        },
        { timeout: 20000 },
      )
      .toBe(file.endsWith("pdf") ? 1 : 2);
  }
  const uploadedState = await state();
  testApplications.push(
    ...uploadedState.vacancies
      .find((x) => x.id === v.id)!
      .batches[0].applications.map((a) => a.id),
  );
  stage = "managed-processing";
  await expect
    .poll(
      async () => {
        const w = await state();
        return w.vacancies
          .find((x) => x.id === v.id)!
          .batches[0].applications.every((a) => a.state === "ready");
      },
      { timeout: 150000, intervals: [2000, 4000, 6000] },
    )
    .toBe(true);
  s = await state();
  const batch = s.vacancies.find((x) => x.id === v.id)!.batches[0];
  stage = "two-pass-classification";
  expect(batch.ranking).toBeNull();
  expect(batch.applications.every((a) => a.score === null)).toBe(true);
  expect(batch.applications.every((a) => a.blocks.length === 6)).toBe(true);
  if (process.env.AI_ENABLED === "true") {
    for (const application of batch.applications) {
      const doc = await db
        .from("documents")
        .select("id")
        .eq("workspace_id", owner.workspaceId)
        .eq("application_key", application.id)
        .single();
      expect(doc.error).toBeNull();
      const run = await db
        .from("assessment_runs")
        .select("config_version,pass_outputs,usage")
        .eq("document_id", doc.data!.id)
        .single();
      expect(run.error).toBeNull();
      expect(run.data!.config_version).toContain(
        ":openai:" + process.env.AI_MODEL_ID + ":",
      );
      expect(run.data!.pass_outputs).toHaveLength(2);
      expect(run.data!.usage).toHaveLength(2);
      expect(
        run.data!.pass_outputs.every((pass: unknown) => pass !== null),
      ).toBe(true);
      expect(
        run.data!.usage.every(
          (usage: { inputTokens: number }) => usage.inputTokens > 0,
        ),
      ).toBe(true);
    }
  }
  stage = "human-review";
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await expect(
      page.getByRole("heading", { name: "Review the evidence", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".review-identity h3")).toHaveText(
      `Candidate 0${i + 1}`,
    );
    for (let c = 0; c < 6; c++) {
      const row = page.locator("article.assessment").nth(c);
      const change = row.getByRole("button", { name: "Change this judgement" });
      if (await change.count()) await change.click();
      await row
        .getByRole("group", { name: "Evidence category" })
        .getByRole("radio", { name: /Full evidence/ })
        .check();
      // Evidence is chosen in the source for the active criterion.
      await row.locator("h4").click();
      const toggle = page
        .getByRole("button", {
          name: /^(Use|Remove) passage .* as evidence for /,
        })
        .nth(c);
      if ((await toggle.getAttribute("aria-pressed")) !== "true")
        await toggle.click();
      const reason = page.locator(`#reason-${sampleRubric[c].id}`);
      if (await reason.count())
        await reason.fill(
          "The fictional source explicitly supports this criterion.",
        );
    }
    for (const check of await page
      .getByLabel("I checked this requirement and its source evidence.", {
        exact: true,
      })
      .all())
      await check.check();
    const flag = page.getByLabel(
      "I checked the flagged source content without treating it as an instruction.",
    );
    if (await flag.count()) await flag.check();
    await page
      .getByLabel(
        "I reviewed this CV, its criteria and the source evidence. These decisions are mine.",
      )
      .check();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "Confirm and next", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Choose your shortlist", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select highest scores", exact: true })
    .click();
  await page
    .getByLabel("Selection reason (required, including an empty shortlist)")
    .fill("Both fictional applications have complete reviewed evidence.");
  await page
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Finalised shortlist", exact: true }),
  ).toBeVisible();
  await page.reload();
  s = await state();
  const frozen = s.vacancies.find((x) => x.id === v.id)!.batches[0];
  expect(frozen.snapshot).toBeTruthy();
  expect(frozen.applications.every((a) => a.score === 100)).toBe(true);
  const exportResponse = await page.request.get(
    origin + `/api/workspace?vacancy=${v.id}&export=${b.id}`,
  );
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-disposition"]).toContain(
    "attachment",
  );
  expect(consoleErrors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/vacancies");
  await page
    .locator(".vacancy-row")
    .filter({ hasText: title })
    .getByRole("link", { name: new RegExp(` for ${title}$`) })
    .click();
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  expect(fits).toBe(true);
  await page.screenshot({ path: "work/hosted-acceptance-final.png" });
  console.log(
    `PASS: hosted real MFA login, browser PDF/DOCX uploads, managed parser/queue, six source blocks each, hidden ranking/scores, manual full-evidence review, two scores of 100, immutable finalisation/export/reload, Axe review and 390px bounds. Provider configuration is recorded in private assessment runs; no real CV used.`,
  );
} catch {
  if (diagnostics.length)
    console.log("Hosted browser diagnostics:", diagnostics.join(","));
  console.log(
    "Hosted browser state:",
    new URL(page.url()).pathname,
    (await page.getByRole("heading", { level: 1 }).allTextContents()).join(
      " | ",
    ),
  );
  throw new Error(
    `Hosted synthetic acceptance failed at stage: ${stage}. No sensitive response included.`,
  );
} finally {
  let cleanupFailed = false;
  // Purge only this test's content via the existing deletion contract. Tombstones
  // stay pending through signed-upload expiry; recovery completes them later.
  // Track test IDs from its own vacancy, including interrupted uploads.
  if (testVacancyId) {
    const latest = await db
      .from("synthetic_workspaces")
      .select("payload")
      .eq("workspace_id", owner.workspaceId)
      .single();
    const vacancy = latest.data?.payload?.vacancies?.find(
      (v: { id: string }) => v.id === testVacancyId,
    );
    for (const batch of vacancy?.batches ?? [])
      for (const app of batch.applications ?? [])
        if (!testApplications.includes(app.id)) testApplications.push(app.id);
    if (latest.error) {
      cleanupFailed = true;
      console.log(
        "Synthetic test content lookup unavailable; cleanup needs retry.",
      );
    }
  }
  for (const id of testApplications) {
    const purged = await db.rpc("delete_application_content", {
      p_workspace: owner.workspaceId,
      p_actor: owner.actor,
      p_application: id,
    });
    if (purged.error) {
      cleanupFailed = true;
      console.log(
        "Test content cleanup pending; inspect synthetic acceptance vacancy.",
      );
    } else if (purged.data?.length) {
      const deletedFiles = await db.storage
        .from("cv-originals")
        .remove(purged.data);
      if (deletedFiles.error) cleanupFailed = true;
    }
  }
  if (owner.actor) {
    const deleted = await db
      .from("workspace_members")
      .delete()
      .eq("workspace_id", owner.workspaceId)
      .eq("user_id", owner.actor);
    const remaining = await db
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", owner.workspaceId)
      .eq("user_id", owner.actor);
    if (deleted.error || remaining.error || remaining.data?.length)
      cleanupFailed = true;
    const removed = await db.auth.admin.deleteUser(owner.actor, true);
    if (removed.error) cleanupFailed = true;
  }
  await browser.close();
  if (cleanupFailed) throw new Error("HOSTED_TEST_CLEANUP_INCOMPLETE");
  console.log(
    "Disposable hosted membership removed; account soft-deleted, historical audit preserved.",
  );
}
