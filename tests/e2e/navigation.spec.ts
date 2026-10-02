import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("root opens the vacancy list with a specific next action", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/vacancies$/);
  await expect(
    page.getByRole("heading", { name: "Vacancies", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Vacancies · Shortlist");
  const action = page.getByRole("link", {
    name: "Set criteria for Customer success manager",
  });
  await expect(action).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await action.click();
  await expect(page).toHaveURL(
    /\/vacancies\/customer-success\/first-batch\/criteria$/,
  );
  await expect(page.locator("#page-title")).toBeFocused();
  await expect(page).toHaveTitle(
    "Customer success manager · Criteria · Shortlist",
  );
});

test("steps have addresses that survive reload and the back button", async ({
  page,
}) => {
  await page.goto("/vacancies/customer-success/first-batch/criteria");
  const steps = page.getByRole("navigation", { name: "Vacancy workflow" });
  await expect(steps.getByRole("link", { name: /Criteria/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await steps.getByRole("link", { name: /Review/ }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(
    page.getByText("Close intake in Add CVs before reviewing applications."),
  ).toBeVisible();
  await page.reload();
  await expect(steps.getByRole("link", { name: /Review/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/criteria$/);
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
});

test("unsaved criteria block in-app navigation and the back button", async ({
  page,
}) => {
  await page.goto("/vacancies");
  await page
    .getByRole("link", { name: "Set criteria for Customer success manager" })
    .click();
  await page.getByLabel("Points", { exact: true }).first().fill("7");
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Vacancy workflow" })
    .getByRole("link", { name: /Add CVs/ })
    .click();
  await expect(page).toHaveURL(/\/criteria$/);
  await expect(
    page.getByText("Save your draft before leaving this step.").first(),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/criteria$/);
  await expect(page.getByLabel("Points", { exact: true }).first()).toHaveValue(
    "7",
  );
});

test("unknown addresses explain themselves and offer a way back", async ({
  page,
}) => {
  await page.goto("/vacancies/nope/first-batch/criteria");
  await expect(
    page.getByRole("heading", { name: "This page does not exist" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to vacancies" }).click();
  await expect(page).toHaveURL(/\/vacancies$/);
});

test("new vacancy is a focused page that lands on its criteria", async ({
  page,
}) => {
  await page.goto("/vacancies/new");
  await expect(
    page.getByRole("heading", { name: "New vacancy", level: 1 }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Job title").fill("Support analyst");
  await page.getByLabel("Team").fill("Customer operations");
  await page
    .getByLabel("Job description")
    .fill("Fictional role for synthetic testing.");
  await page.getByRole("button", { name: "Create and set criteria" }).click();
  await expect(page).toHaveURL(/\/criteria$/);
  await expect(
    page.getByRole("heading", { name: "Support analyst", level: 1 }),
  ).toBeVisible();
});

test("theme can be chosen from the account menu", async ({ page }) => {
  await page.goto("/vacancies");
  await page.getByRole("button", { name: /Recruiter workspace/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
