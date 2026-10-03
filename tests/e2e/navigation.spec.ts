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

test("the command menu jumps to steps and respects unsaved drafts", async ({
  page,
}) => {
  await page.goto("/vacancies/customer-success/first-batch/criteria");
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Jump to" });
  await expect(menu).toBeVisible();
  await menu.getByRole("combobox").fill("Add CVs");
  // Wait for the menu to highlight a match, as a person would see it.
  await expect(
    menu.getByRole("option", { name: /Add CVs/ }).first(),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/cvs$/);
  await page.getByRole("button", { name: /Jump to/ }).click();
  await menu.getByRole("combobox").fill("Criteria");
  // Wait for the menu to highlight a match, as a person would see it.
  await expect(
    menu.getByRole("option", { name: /Criteria/ }).first(),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/criteria$/);
  await page.getByLabel("Points", { exact: true }).first().fill("9");
  await page.keyboard.press("ControlOrMeta+k");
  await menu.getByRole("combobox").fill("Vacancies");
  // Wait for the menu to highlight a match, as a person would see it.
  await expect(
    menu.getByRole("option", { name: /Vacancies/ }).first(),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/criteria$/);
  await expect(
    page.getByText("Save your draft before leaving this step.").first(),
  ).toBeVisible();
});

test("tablet widths use an icon rail that keeps every name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/vacancies");
  const rail = page.locator("aside.sidebar");
  expect((await rail.boundingBox())!.width).toBeLessThanOrEqual(80);
  const nav = rail.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Vacancies" })).toBeVisible();
  await expect(rail.getByRole("button", { name: /Jump to/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("saving says what happened", async ({ page }) => {
  await page.goto("/vacancies/customer-success/first-batch/criteria");
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false))
    await dialog
      .getByRole("button", { name: "Publish criteria", exact: true })
      .click();
  await expect(page.getByText("Criteria published")).toBeVisible();
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await expect(page.getByText("Six sample CVs added")).toBeVisible();
});

test("blocked steps offer the way forward", async ({ page }) => {
  await page.goto("/vacancies/customer-success/first-batch/review");
  await page.getByRole("button", { name: "Go to Add CVs" }).click();
  await expect(page).toHaveURL(/\/cvs$/);
});

test("the first screen arrives with data once the workspace cookie exists", async ({
  page,
}) => {
  // The first visit sets the local demo cookie through the API.
  await page.goto("/vacancies");
  await expect(
    page.getByRole("link", {
      name: /Set criteria for Customer success manager/,
    }),
  ).toBeVisible();
  const html = await (await page.request.get("/vacancies")).text();
  expect(html).toContain("Customer success manager");
  expect(html).not.toContain("Preparing your workspace");
  const headers = (await page.request.get("/vacancies")).headers();
  expect(headers["cache-control"]).toMatch(/no-store|private/);
});

test("finalised vacancies collapse below open work", async ({ page }) => {
  // Establish one workspace cookie before navigation starts concurrent reads.
  // Otherwise a late first-load response can replace the cookie between writes.
  const initial = await page.request.get("/api/workspace");
  expect(initial.ok()).toBe(true);
  await page.goto("/vacancies");
  await page.evaluate(async () => {
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
        if (r.status !== 409 || attempt === 3)
          throw new Error(`${r.status} ${JSON.stringify(body)}`);
      }
    };
    const ids = { vacancyId: "customer-success", batchId: "first-batch" };
    await post({ type: "publish", ...ids });
    await post({ type: "samples", ...ids });
    let state = await post({ type: "close", ...ids });
    for (const app of state.vacancies[0].batches[0].applications) {
      const decisions = Object.fromEntries(
        Object.entries(
          app.assessments as Record<
            string,
            { category: string; evidence: string[] }
          >,
        ).map(([id, a]) => [
          id,
          {
            category: a.category === "UNCLEAR" ? "PARTIAL" : a.category,
            evidence: a.evidence,
            checked: true,
            reason: "Checked against the fictional source.",
          },
        ]),
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
    await post({
      type: "selection",
      ...ids,
      selected: [],
      reason: "Fictional exercise, nobody selected.",
      tieReason: "",
      exceptions: {},
    });
    await post({ type: "finalise", ...ids });
    await post({
      type: "create",
      title: "Support analyst",
      team: "Operations",
      description: "Fictional role for grouping.",
    });
  });
  await page.reload();
  const sidebar = page.getByRole("navigation", { name: "Your vacancies" });
  await expect(
    sidebar.getByRole("link", { name: "Support analyst" }),
  ).toBeVisible();
  const group = sidebar.locator("details.side-finalised");
  await expect(group).not.toHaveAttribute("open", "");
  await expect(group.locator("summary")).toContainText("Finalised (1)");
  await expect(
    page
      .getByRole("list", { name: "Finalised vacancies" })
      .getByText("Customer success manager"),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
