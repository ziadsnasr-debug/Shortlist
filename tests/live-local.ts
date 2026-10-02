// Explicit local owner + actual managed parser acceptance. Fictional uploads only.
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import { publicState } from "../lib/workflow";
type View = ReturnType<typeof publicState>;
import { sampleRubric } from "../fixtures/synthetic/seed";
import { totp } from "../scripts/local-authenticator";
process.loadEnvFile(".env.local");
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== "127.0.0.1")
  throw new Error("LOCAL_ONLY");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const owner = JSON.parse(await readFile("work/local-owner.json", "utf8"));
const origin = "http://127.0.0.1:3218";
const browser = await chromium.launch();
const context = await browser.newContext(),
  page = await context.newPage();
const consoleErrors: string[] = [];
page.on("pageerror", () => consoleErrors.push("page-error"));
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
const bypass = process.env.LOCAL_AUTH_BYPASS === "true";
try {
  const anonymousReadiness = await context.request.get(
    origin + "/api/readiness",
  );
  expect(anonymousReadiness.status()).toBe(bypass ? 200 : 401);
  if (bypass) {
    expect(
      (
        await context.request.get(origin + "/api/workspace", {
          headers: { host: "attacker.example:3218" },
        })
      ).status(),
    ).toBe(403);
    await page.goto(origin + "/login");
    await expect(page).toHaveURL(origin + "/");
  } else {
    await page.goto(origin + "/login");
    await page.getByLabel("Email", { exact: true }).fill(owner.email);
    await page.getByLabel("Password", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByLabel("Six digit authenticator code")
      .fill(totp(owner.secret));
    await page.getByRole("button", { name: "Verify and continue" }).click();
  }
  await page.goto(origin + "/vacancies");
  await expect(
    page.getByRole("heading", { name: "Vacancies", level: 1 }),
  ).toBeVisible();
  const privateReadiness = await context.request.get(origin + "/api/readiness");
  expect(privateReadiness.status()).toBe(200);
  expect(privateReadiness.headers()["cache-control"]).toBe("private, no-store");
  const readiness = await privateReadiness.json();
  expect(Object.keys(readiness).sort()).toEqual(["checks", "status"]);
  expect(readiness.status).toBe("configuration_ready");
  for (const check of readiness.checks)
    expect(Object.keys(check).sort()).toEqual(["name", "status"]);
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
  for (let n = 0; n < 5; n++) {
    const r = await page.request.post(origin + "/api/administration", {
      headers: { origin },
      data: { type: "process" },
    });
    expect(r.status()).toBe(200);
  }
  const title = "Actual document check " + Date.now();
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
  await action({ ...base, type: "rubric", rubric: sampleRubric });
  await action({ ...base, type: "publish" });
  await page.reload();
  await page.goto(origin + "/vacancies");
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
  await page.screenshot({ path: "work/live-local-final.png" });
  console.log(
    `PASS: ${bypass ? "local synthetic login bypass" : "real MFA login"}, browser PDF/DOCX uploads, managed parser/queue, six source blocks each, hidden ranking/scores, manual full-evidence review, two scores of 100, immutable finalisation/export/reload, Axe review and 390px bounds. Provider configuration is recorded in private assessment runs; no real CV used.`,
  );
} catch (error) {
  await page.screenshot({ path: "work/live-local-failure.png" });
  throw error;
} finally {
  await browser.close();
}
