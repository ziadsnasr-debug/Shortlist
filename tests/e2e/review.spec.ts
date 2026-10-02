import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const base = "/vacancies/customer-success/first-batch";

async function toReview(page: Page) {
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
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review the evidence" }),
  ).toBeVisible();
}

test("agreed criteria stay compact while checks open with a reason", async ({
  page,
}) => {
  await toReview(page);
  const rows = page.locator("article.assessment");
  await expect(rows).toHaveCount(6);
  const agreed = page.locator("article.assessment.agreed");
  const checks = page.locator("article.assessment.needs-check");
  expect((await agreed.count()) + (await checks.count())).toBe(6);
  await expect(checks.first().getByText("Check required")).toBeVisible();
  if (await agreed.count()) {
    const index = await rows.evaluateAll((els) =>
      els.findIndex((el) => el.classList.contains("agreed")),
    );
    const row = rows.nth(index);
    await expect(
      row.getByRole("group", { name: "Evidence category" }),
    ).toHaveCount(0);
    await row.getByRole("button", { name: "Change this judgement" }).click();
    await row
      .getByRole("group", { name: "Evidence category" })
      .getByRole("radio", { name: /Needs your judgement/ })
      .check();
    await expect(row).toHaveClass(/needs-check/);
    await expect(row.getByText("Review reason (required)")).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Confirm and next", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".review-bar-status")).toContainText(
    /Needs your judgement|individual check|review reason|reviewed this CV/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("evidence is chosen in the source for the active criterion", async ({
  page,
}) => {
  await toReview(page);
  const row = page.locator("article.assessment").first();
  await row.locator("h4").click();
  const title = (await row.locator("h4").textContent())!;
  await expect(page.locator(".source-header p")).toContainText(title);
  const toggles = page.getByRole("button", {
    name: new RegExp(`passage .* as evidence for ${title}`),
  });
  await expect(toggles.first()).toBeVisible();
  const before = await page.locator(".source-block.is-evidence").count();
  const target = toggles.nth(5);
  const pressed = (await target.getAttribute("aria-pressed")) === "true";
  await target.click();
  await expect(target).toHaveAttribute(
    "aria-pressed",
    pressed ? "false" : "true",
  );
  await expect(page.locator(".source-block.is-evidence")).toHaveCount(
    before + (pressed ? -1 : 1),
  );
  await expect(
    page.getByRole("status").getByText("Unsaved changes"),
  ).toBeVisible();
});

test("keyboard shortcuts move, judge and explain, and pause while typing", async ({
  page,
}) => {
  await toReview(page);
  await page.locator("article.assessment").first().locator("h4").click();
  await page.keyboard.press("j");
  await expect(page.locator("article.assessment").nth(1)).toHaveClass(
    /is-active/,
  );
  await page.keyboard.press("4");
  await expect(page.locator("article.assessment").nth(1)).toHaveClass(
    /needs-check/,
  );
  await page.keyboard.press("e");
  const reason = page.locator("article.assessment").nth(1).locator("textarea");
  await expect(reason).toBeFocused();
  await page.keyboard.type("j1");
  await expect(reason).toHaveValue("j1");
  await expect(page.locator("article.assessment").nth(1)).toHaveClass(
    /is-active/,
  );
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
});

test("the CV list moves between candidates and respects unsaved work", async ({
  page,
}) => {
  await toReview(page);
  const queue = page.getByRole("navigation", { name: "CVs in this batch" });
  await queue.getByRole("button", { name: /Candidate 02/ }).click();
  await expect(page).toHaveURL(/\/review\/02$/);
  await expect(page.locator(".review-identity h3")).toHaveText("Candidate 02");
  await page.locator("article.assessment").first().locator("h4").click();
  await page.keyboard.press("2");
  await queue.getByRole("button", { name: /Candidate 03/ }).click();
  await expect(page).toHaveURL(/\/review\/02$/);
  await expect(
    page.getByText("Save your draft before leaving this step.").first(),
  ).toBeVisible();
});

test("narrow screens switch between criteria and source tabs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await toReview(page);
  const tabs = page.getByRole("tablist", { name: "Review panes" });
  await expect(page.locator(".source")).toBeHidden();
  await tabs.getByRole("tab", { name: "Source" }).click();
  await expect(page.locator(".source")).toBeVisible();
  await expect(page.locator("article.assessment").first()).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
