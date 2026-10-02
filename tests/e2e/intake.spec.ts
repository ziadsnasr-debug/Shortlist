import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const base = "/vacancies/customer-success/first-batch";

// Publishing may ask for confirmation; accept it either way.
async function publish(page: Page) {
  await page.goto(base + "/criteria");
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false))
    await dialog
      .getByRole("button", { name: "Publish criteria", exact: true })
      .click();
  await expect(page).toHaveURL(/\/cvs$/);
}

test("intake explains what blocks the review and shows batch readiness", async ({
  page,
}) => {
  await publish(page);
  const start = page.getByRole("button", { name: "Start review", exact: true });
  await expect(start).toBeDisabled();
  await expect(
    page.getByText("Add at least one CV to start the review."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await expect(page.getByText("6 of 6 ready")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "CVs ready to review" }),
  ).toHaveAttribute("aria-valuetext", "6 of 6 ready");
  await expect(page.getByText("Ready to review")).toHaveCount(6);
  await expect(start).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("dispositions are recorded inline and leave the count", async ({
  page,
}) => {
  await publish(page);
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  const row = page.locator(".file-row").filter({ hasText: "Candidate 02" });
  await row.getByRole("button", { name: "Record disposition" }).click();
  await expect(
    row.getByRole("button", { name: "Record disposition" }).first(),
  ).toHaveAttribute("aria-expanded", "true");
  await row.getByRole("combobox", { name: "Disposition" }).click();
  await page.getByRole("option", { name: "Withdrawal" }).click();
  await row.getByLabel("Reason").fill("Fictional candidate withdrew.");
  await row
    .locator("form")
    .getByRole("button", { name: "Record disposition" })
    .click();
  await expect(row.getByText("Disposition recorded")).toBeVisible();
  await expect(page.getByText("5 of 5 ready")).toBeVisible();
});

test("processing demo walks the real stages and settles on an honest result", async ({
  page,
}) => {
  await page.goto("/design");
  const demo = page.locator("section", {
    has: page.getByRole("heading", { name: "Processing" }),
  });
  await demo.getByRole("button", { name: "Replay processing" }).click();
  await expect(demo.getByText("Queued or processing").first()).toBeVisible();
  await expect(
    demo.getByText("Reading the CV and finding evidence").first(),
  ).toBeVisible({ timeout: 8000 });
  await expect(demo.getByText("Needs a readable copy")).toBeVisible({
    timeout: 15000,
  });
  await expect(demo.getByText("3 of 4 ready")).toBeVisible({ timeout: 15000 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("processing demo skips movement under reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design");
  const demo = page.locator("section", {
    has: page.getByRole("heading", { name: "Processing" }),
  });
  await demo.getByRole("button", { name: "Replay processing" }).click();
  await expect(demo.getByText("3 of 4 ready")).toBeVisible();
  expect(
    await demo
      .locator(".glyph-scan")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
