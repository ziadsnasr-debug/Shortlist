import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { publishCriteria } from "./criteria-helpers";

const criteria = "/vacancies/customer-success/first-batch/criteria";
const origin = "http://127.0.0.1:3217";
const incompleteReason =
  "Add a requirement and both evidence definitions to every criterion before saving.";

async function open(page: Page) {
  await page.goto(criteria);
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
}
const allocation = (page: Page) =>
  page.getByRole("region", { name: "Criteria weight allocation" });
const requirements = (page: Page) =>
  page.getByLabel("Requirement", { exact: true });

test("allocation text follows every change to the points", async ({ page }) => {
  await open(page);
  await expect(
    allocation(page).getByText("100 of 100 points · ready to publish"),
  ).toBeVisible();
  const first = page.getByLabel("Points", { exact: true }).first();
  await first.fill("19");
  await expect(
    allocation(page).getByText("94 of 100 points · 6 to allocate"),
  ).toBeVisible();
  await first.fill("29");
  await expect(
    allocation(page).getByText("104 of 100 points · 4 over"),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Decrease points for Independent account ownership",
    })
    .click();
  await expect(
    allocation(page).getByText("103 of 100 points · 3 over"),
  ).toBeVisible();
  await expect(first).toHaveValue("28");
  await expect(
    page.getByText("Publishing needs exactly 100 points."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Publish criteria", exact: true }),
  ).toBeDisabled();
});

test("role template picker is accessible and loads a fresh valid draft", async ({
  page,
}) => {
  await page.route("**/api/workspace?reveal=false", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.vacancies[0].batches[0].rubric = [];
    body.vacancies[0].batches[0].published = false;
    await route.fulfill({ response, json: body });
  });
  await open(page);
  const picker = page.getByLabel("Start from a role template", {
    exact: false,
  });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue("");
  await picker.selectOption("service-desk");
  await expect(requirements(page)).toHaveCount(4);
  await expect(
    allocation(page).getByText("100 of 100 points · ready to publish"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Notifications alt+T" })
      .getByText("Review and edit before saving."),
  ).toBeVisible();
});

test("templates save, persist, stay hidden after publish, and are admin-only", async ({
  page,
}) => {
  async function createVacancy(title: string) {
    const current = await (await page.request.get("/api/workspace")).json();
    const response = await page.request.post("/api/workspace", {
      headers: { origin },
      data: {
        version: current.version,
        action: {
          type: "create",
          title,
          team: "Template QA",
          description: "Fictional template acceptance role.",
        },
      },
    });
    expect(response.status()).toBe(200);
    const state = await response.json();
    const vacancy = state.vacancies.at(-1);
    return { vacancy, batch: vacancy.batches[0] };
  }

  const first = await createVacancy("Template persistence one");
  const firstPath = `/vacancies/${first.vacancy.id}/${first.batch.id}/criteria`;
  await page.goto(firstPath);
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
  const picker = page.getByLabel("Start from a role template", {
    exact: false,
  });
  await picker.selectOption("accounts-assistant");
  await expect(page.getByRole("textbox", { name: "Requirement" })).toHaveCount(
    4,
  );
  await expect(page.getByLabel("Requirement").first()).toHaveValue(
    "Transaction processing",
  );
  await page
    .getByRole("button", { name: "Save criteria draft", exact: true })
    .click();
  await expect(
    page.getByText("Criteria draft saved", { exact: true }),
  ).toBeVisible();
  const savedFirst = await (await page.request.get("/api/workspace")).json();
  const firstSaved = savedFirst.vacancies.find(
    (v: { id: string }) => v.id === first.vacancy.id,
  ).batches[0];
  const firstIds = firstSaved.rubric.map(
    (criterion: { id: string }) => criterion.id,
  );
  expect(firstIds).toHaveLength(4);
  await page.reload();
  await expect(page.getByLabel("Requirement").first()).toHaveValue(
    "Transaction processing",
  );

  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  const published = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspace") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name: "Publish these criteria?" })
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  expect((await published).status()).toBe(200);
  await expect(
    page.getByText("Criteria published", { exact: true }),
  ).toBeVisible();
  await page.goto(firstPath);
  await expect(
    page.getByLabel("Start from a role template", { exact: false }),
  ).toHaveCount(0);

  const second = await createVacancy("Template persistence two");
  const secondPath = `/vacancies/${second.vacancy.id}/${second.batch.id}/criteria`;
  await page.goto(secondPath);
  await page
    .getByLabel("Start from a role template", { exact: false })
    .selectOption("accounts-assistant");
  await page
    .getByRole("button", { name: "Save criteria draft", exact: true })
    .click();
  await expect(
    page.getByText("Criteria draft saved", { exact: true }),
  ).toBeVisible();
  const savedSecond = await (await page.request.get("/api/workspace")).json();
  const secondSaved = savedSecond.vacancies.find(
    (v: { id: string }) => v.id === second.vacancy.id,
  ).batches[0];
  const secondIds = secondSaved.rubric.map(
    (criterion: { id: string }) => criterion.id,
  );
  expect(secondIds).toHaveLength(4);
  expect(new Set([...firstIds, ...secondIds]).size).toBe(8);

  const reviewer = await createVacancy("Template reviewer view");
  const reviewerView = await (await page.request.get("/api/workspace")).json();
  // Fresh demo session exercises the API fallback; an existing session now has SSR data.
  await page.context().clearCookies();
  await page.route("**/api/workspace?reveal=false", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...reviewerView, role: "reviewer" },
    });
  });
  await page.goto(
    `/vacancies/${reviewer.vacancy.id}/${reviewer.batch.id}/criteria`,
  );
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Start from a role template", { exact: false }),
  ).toHaveCount(0);
});

test("sections group the criteria and the menu moves a row", async ({
  page,
}) => {
  await open(page);
  for (const name of ["Experience", "Skills", "Education"])
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
  await expect(requirements(page).first()).toHaveValue(
    "Independent account ownership",
  );
  await page
    .getByRole("button", {
      name: "More actions for Independent account ownership",
    })
    .click();
  await expect(page.getByRole("menuitem", { name: "Move up" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await expect(requirements(page).first()).toHaveValue("Customer facing work");
  await expect(requirements(page).nth(1)).toHaveValue(
    "Independent account ownership",
  );
  await expect(page.getByText("Unsaved changes").first()).toBeVisible();
});

test("removing a criterion can be undone from the toast", async ({ page }) => {
  await open(page);
  await expect(requirements(page)).toHaveCount(6);
  await page
    .getByRole("button", { name: "More actions for Customer onboarding" })
    .click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(requirements(page)).toHaveCount(5);
  await expect(
    allocation(page).getByText("80 of 100 points · 20 to allocate"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(requirements(page)).toHaveCount(6);
  await expect(requirements(page).filter({ hasText: "" }).nth(2)).toHaveValue(
    "Customer onboarding",
  );
  await expect(
    allocation(page).getByText("100 of 100 points · ready to publish"),
  ).toBeVisible();
});

test("an incomplete criterion disables saving and says why", async ({
  page,
}) => {
  await open(page);
  const save = page.getByRole("button", {
    name: "Save criteria draft",
    exact: true,
  });
  await expect(save).toBeEnabled();
  await page.getByRole("button", { name: "Add criterion" }).click();
  await expect(save).toBeDisabled();
  await expect(page.getByText(incompleteReason)).toBeVisible();
  await expect(save).toHaveAccessibleDescription(incompleteReason);
  await expect(page.getByText("Needs definitions")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish criteria", exact: true }),
  ).toBeDisabled();
  await requirements(page).last().fill("Stakeholder communication");
  await expect(save).toBeDisabled();
  await page.getByLabel("Full evidence").fill("Leads executive reviews.");
  await page.getByLabel("Partial evidence").fill("Attends executive reviews.");
  await expect(save).toBeEnabled();
  await expect(page.getByText("Needs definitions")).toHaveCount(0);
  await save.click();
  await expect(
    page.getByText("Criteria draft saved", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toHaveCount(0);
});

test("publishing asks first and Cancel leaves the criteria open", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Publish these criteria?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      "Publishing freezes these criteria for this batch. You can't change them after CVs are added.",
    ),
  ).toBeVisible();
  await expect(dialog.getByText("Criteria", { exact: true })).toBeVisible();
  await expect(dialog.locator("dd")).toHaveText(["6", "2", "100"]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/criteria$/);
  const state = await (await page.request.get("/api/workspace")).json();
  expect(state.vacancies[0].batches[0].published).toBe(false);
  await publishCriteria(page);
  await expect(page).toHaveURL(/\/cvs$/);
  const after = await (await page.request.get("/api/workspace")).json();
  expect(after.vacancies[0].batches[0].published).toBe(true);
});

test("a stale save shows a banner and Load latest discards the draft", async ({
  page,
}) => {
  await open(page);
  const state = await (await page.request.get("/api/workspace")).json();
  const rubric = state.vacancies[0].batches[0].rubric;
  rubric[0].title = "Changed by someone else";
  const saved = await page.request.post("/api/workspace", {
    headers: { origin },
    data: {
      version: state.version,
      action: {
        type: "rubric",
        vacancyId: "customer-success",
        batchId: "first-batch",
        rubric,
      },
    },
  });
  expect(saved.status()).toBe(200);
  await page.getByLabel("Points", { exact: true }).first().fill("26");
  await page
    .getByRole("button", { name: "Save criteria draft", exact: true })
    .click();
  const banner = page
    .getByRole("alert")
    .filter({ hasText: "Another save changed this workspace. Your draft" });
  await expect(banner).toBeVisible();
  await expect(page.getByLabel("Points", { exact: true }).first()).toHaveValue(
    "26",
  );
  await banner.getByRole("button", { name: "Load latest" }).click();
  await expect(banner).toBeHidden();
  await expect(requirements(page).first()).toHaveValue(
    "Changed by someone else",
  );
  await expect(page.getByLabel("Points", { exact: true }).first()).toHaveValue(
    "25",
  );
  await expect(page.getByText("Unsaved changes")).toHaveCount(0);
});

test("evidence definitions expand inline", async ({ page }) => {
  await open(page);
  const toggle = page.getByRole("button", { name: "Evidence definitions" });
  await expect(toggle.first()).toHaveAttribute("aria-expanded", "false");
  await toggle.first().click();
  await expect(toggle.first()).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Full evidence")).toHaveValue(
    "Direct responsibility for an account portfolio and customer outcomes.",
  );
});

test("AI drafting shows placeholders, then marks drafted rows until edited", async ({
  page,
}) => {
  await page.route(/\/api\/workspace(\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, capabilities: { uploads: false, ai: true } },
    });
  });
  await page.route("**/api/criteria", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const rubric = [0, 1, 2].map((i) => ({
      id: `ai-${i}`,
      section: "Skills",
      title: `Drafted requirement ${i + 1}`,
      points: i === 0 ? 40 : 30,
      essential: i === 0,
      full: "Clear evidence in the CV.",
      partial: "Some evidence in the CV.",
    }));
    await route.fulfill({ json: { rubric } });
  });
  await open(page);
  await page.getByRole("button", { name: "Draft criteria with AI" }).click();
  await expect(page.getByText("Drafting criteria")).toBeAttached();
  await expect(requirements(page)).toHaveCount(0);
  await expect(requirements(page)).toHaveCount(3);
  await expect(page.getByText("AI draft · edit freely")).toHaveCount(3);
  await requirements(page).first().fill("Edited requirement");
  await expect(page.getByText("AI draft · edit freely")).toHaveCount(2);
  await expect(
    allocation(page).getByText("100 of 100 points · ready to publish"),
  ).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`criteria builder has no accessibility violations in ${scheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await page
      .getByRole("button", { name: "Evidence definitions" })
      .first()
      .click();
    await page.getByRole("button", { name: "Add criterion" }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
