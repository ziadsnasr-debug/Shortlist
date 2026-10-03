import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const base = "/vacancies/customer-success/first-batch";

// Publish, add samples and confirm every CV through the API so these tests
// start on the results screen.
async function toResults(page: Page) {
  await page.goto("/vacancies");
  const ok = await page.evaluate(async () => {
    const post = async (action: object) => {
      // Re-read the version and retry, since the page's own requests can
      // move it between the read and the write.
      for (let attempt = 0; ; attempt++) {
        const s = await (await fetch("/api/workspace")).json();
        const r = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: s.version, action }),
        });
        const body = await r.json();
        if (r.ok) return body;
        if (attempt === 3)
          throw new Error(`${r.status} ${JSON.stringify(body)}`);
      }
    };
    const ids = { vacancyId: "customer-success", batchId: "first-batch" };
    await post({ type: "publish", ...ids });
    await post({ type: "samples", ...ids });
    let state = await post({ type: "close", ...ids });
    const batch = state.vacancies[0].batches[0];
    for (const app of batch.applications) {
      const decisions = Object.fromEntries(
        Object.entries(
          app.assessments as Record<
            string,
            {
              category: string;
              initial: string;
              evidence: string[];
              flagged: boolean;
            }
          >,
        ).map(([id, a]) => {
          const category = a.category === "UNCLEAR" ? "PARTIAL" : a.category;
          return [
            id,
            {
              category,
              evidence: a.evidence,
              checked: true,
              reason: "Checked against the fictional source.",
            },
          ];
        }),
      );
      state = await post({
        type: "review",
        ...ids,
        applicationId: app.id,
        runId: app.runId,
        documentVersion: app.documentVersion,
        decisions,
        sourceChecked: true,
        confirm: true,
        attest: true,
      });
    }
    return !!state.vacancies[0].batches[0].ranking;
  });
  expect(ok).toBe(true);
  await page.goto(base + "/shortlist");
  await expect(
    page.getByRole("heading", { name: "Choose your shortlist" }),
  ).toBeVisible();
}

test("results explain the spread, mark the cut and offer a table", async ({
  page,
}) => {
  await toResults(page);
  await expect(page.locator(".summary-line")).toContainText(
    "6 CVs reviewed. Confirmed scores range from",
  );
  await expect(page.locator(".score-row")).toHaveCount(6);
  await expect(page.locator(".score-row.below-cut")).toHaveCount(1);
  const first = page.locator(".score-composition").first();
  await expect(first).toHaveAttribute("role", "img");
  await expect(first).toHaveAttribute(
    "aria-label",
    /of 100: .* from full evidence/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const table = page.getByRole("region", { name: "Confirmed scores table" });
  await expect(table.getByRole("row")).toHaveCount(7);
  await page.emulateMedia({ colorScheme: "dark" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("selection fields appear only when a rule needs them", async ({
  page,
}) => {
  await toResults(page);
  await expect(page.getByLabel("Boundary tie decision")).toHaveCount(0);
  await page.getByRole("button", { name: "Select highest scores" }).click();
  await expect(page.locator(".selection-tray")).toContainText("selected");
  const rows = page.locator(".score-row");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const box = row.getByRole("checkbox");
    const essentials = await row.locator(".score-who p").textContent();
    if (
      !(await box.isChecked()) &&
      !(await box.isDisabled()) &&
      essentials?.startsWith("Essential not fully")
    ) {
      await box.check();
      await expect(row.getByLabel(/Essential exception for/)).toBeVisible();
      break;
    }
  }
  await expect(
    page.getByRole("button", { name: "Finalise shortlist", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Record a written selection reason, including when selecting nobody.",
    ),
  ).toBeVisible();
});

test("an empty shortlist finalises after confirmation and shows the receipt", async ({
  page,
}) => {
  await toResults(page);
  await page
    .getByLabel("Selection reason (required, including an empty shortlist)")
    .fill("No fictional CV met the bar for this synthetic exercise.");
  await page
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Finalise this shortlist?",
  });
  await expect(confirm.getByText("Nobody (empty shortlist)")).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(confirm).toBeHidden();
  await page
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  await confirm
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shortlist finalised" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Export review CSV" }),
  ).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
