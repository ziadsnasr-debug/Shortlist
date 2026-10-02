import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const criteria = "/vacancies/customer-success/first-batch/criteria";

test("weight chart follows edits and stays readable at narrow sizes", async ({
  page,
}) => {
  await page.goto(criteria);
  await expect(
    page.getByRole("region", { name: "Criteria weight allocation" }),
  ).toBeVisible();
  await page.getByLabel("Points", { exact: true }).first().fill("1");
  await expect(page.getByText(/points left to allocate/)).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("region", { name: "Criteria weight allocation" }),
    ).toBeVisible();
    const bounds = await page.locator(".insight-panel").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("source links focus actual passage; reduced motion and review gates remain intact", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(criteria);
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Vacancy workflow" })
    .getByRole("link", { name: /Shortlist/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review every CV first" }),
  ).toBeVisible();
  await expect(page.locator(".score-track, .comparison-panel")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Vacancy workflow" })
    .getByRole("link", { name: /Add CVs/ })
    .click();
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 850 });
  await page.locator(".quote").first().click();
  await expect(page.locator(".source-block.highlighted")).toBeFocused();
  await expect(page.locator(".source-block.highlighted")).toBeInViewport();
  expect(
    await page
      .locator(".progress-track span")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await expect(
    page.getByRole("button", { name: "Confirm and next", exact: true }),
  ).toBeDisabled();
});

test("mobile workspace retains administration navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto(criteria);
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await menu
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Vacancies", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vacancies", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/vacancies$/);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Administration" })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Administration", level: 1 }),
  ).toBeVisible();
});
