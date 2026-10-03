import { expect, test, type Page } from "@playwright/test";
import { publishCriteria } from "./criteria-helpers";
import { origin } from "./origin";

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

const file = {
  name: "fictional.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\nfictional mock\n"),
};
async function intake(page: Page) {
  await page.route("**/api/workspace*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.capabilities = { ...body.capabilities, uploads: true };
    for (const vacancy of body.vacancies)
      for (const batch of vacancy.batches)
        for (const app of batch.applications)
          if (app.id === "A101") app.state = "processing";
    await route.fulfill({ response, json: body });
  });
  await page.goto("/vacancies/customer-success/first-batch/criteria");
  await publishCriteria(page);
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await page
    .getByLabel("I confirm these files contain fictional data only.")
    .check();
}

test("interrupted upload remains visible and polling does not erase its error", async ({
  page,
}) => {
  let refreshFails = false;
  await page.route("**/api/documents", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        status: refreshFails ? 503 : 200,
        json: refreshFails
          ? { error: "TEMPORARY" }
          : {
              documents: [
                {
                  id: "document",
                  application_key: "A101",
                  status: "reserved",
                  attempts: 0,
                  stage: "awaiting_upload",
                  reservation_age_seconds: 5,
                  safe_error_message: null,
                },
                {
                  id: "other-batch",
                  application_key: "OTHER-CV",
                  status: "complete",
                  attempts: 1,
                  stage: "ready",
                  reservation_age_seconds: 5,
                  safe_error_message: null,
                },
              ],
              stateVersion: 1,
            },
      });
    await route.fulfill({
      json: {
        documentId: "document",
        applicationId: "A101",
        uploadUrl: `${origin}/mock-upload`,
        version: 2,
      },
    });
  });
  await page.route("**/mock-upload", (route) =>
    route.fulfill({ status: 500, body: "failed" }),
  );
  await intake(page);
  await page.getByLabel("Choose fictional CV").setInputFiles(file);
  const failure = page.getByText(
    "The upload didn't finish. The file stays listed so you can retry or record a disposition.",
    { exact: false },
  );
  await expect(failure).toBeVisible();
  await expect(
    page.getByText("Status: Awaiting upload", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".file-row").filter({ hasText: "OTHER-CV" }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".file-row")
      .filter({ hasText: "Candidate 01" })
      .getByRole("button", { name: "Transcribe passages" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh processing status" }).click();
  await expect(failure).toBeVisible();
  refreshFails = true;
  await page.getByRole("button", { name: "Refresh processing status" }).click();
  await expect(
    page.getByText("Unable to refresh processing status. Try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(failure).toBeVisible();
  refreshFails = false;
  await page.getByRole("button", { name: "Refresh processing status" }).click();
  await expect(
    page.getByText("Unable to refresh processing status. Try again.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(failure).toBeVisible();
});

test("transfer and queue progress do not claim analysis has completed", async ({
  page,
}) => {
  let releaseReserve!: () => void,
    releaseUpload!: () => void,
    releaseQueue!: () => void;
  const reserveGate = new Promise<void>((r) => {
    releaseReserve = r;
  });
  const uploadGate = new Promise<void>((r) => {
    releaseUpload = r;
  });
  const queueGate = new Promise<void>((r) => {
    releaseQueue = r;
  });
  await page.route("**/api/documents", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { documents: [], stateVersion: 1 } });
    if (route.request().postDataJSON().type === "reserve") {
      await reserveGate;
      return route.fulfill({
        json: {
          documentId: "document",
          applicationId: "A101",
          uploadUrl: `${origin}/mock-upload`,
          version: 2,
        },
      });
    }
    await queueGate;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/mock-upload", async (route) => {
    await uploadGate;
    await route.fulfill({ status: 200, body: "" });
  });
  try {
    await intake(page);
    await page.getByLabel("Choose fictional CV").setInputFiles(file);
    await expect(
      page.getByText("Reserving a private upload slot.", { exact: true }),
    ).toBeVisible();
    releaseReserve();
    await expect(
      page.getByText("Uploading the fictional file.", { exact: true }),
    ).toBeVisible();
    releaseUpload();
    await expect(
      page.getByText("Queueing the uploaded file.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Choose fictional CV")).toBeDisabled();
    releaseQueue();
    await expect(page.getByLabel("Choose fictional CV")).toBeEnabled();
    await expect(
      page.getByText(
        "CV queued. Processing continues even if you close this page.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.locator(".file-row").filter({ hasText: "OTHER-CV" }),
    ).toHaveCount(0);
  } finally {
    releaseReserve();
    releaseUpload();
    releaseQueue();
  }
});
