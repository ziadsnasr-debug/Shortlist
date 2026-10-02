import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Fictional ids only.
const adminId = "3f9a1c2e-0000-4000-8000-000000000001";
const reviewerId = "7b2d4e6f-0000-4000-8000-000000000002";
const removedId = "c81e5a90-0000-4000-8000-000000000003";

function payload(
  paused: boolean,
  allowance?: {
    period: string;
    used: number;
    limit: number;
    remaining: number;
    state: "normal" | "near_limit" | "exhausted";
  },
) {
  return {
    settings: { paused, retentionDays: 90, incidentOwner: "Operations lead" },
    members: [
      { user_id: adminId, role: "administrator", active: true },
      { user_id: reviewerId, role: "reviewer", active: true },
      { user_id: removedId, role: "reviewer", active: false },
    ],
    documents: [
      {
        id: "d1000000-0000-4000-8000-0000000000a1",
        status: "readable_copy",
        safe_error_code: "NEEDS_READABLE_COPY",
        deletion_state: "retained",
      },
      {
        id: "d1000000-0000-4000-8000-0000000000a2",
        status: "attention",
        safe_error_code: "FILE_SIGNATURE",
        deletion_state: "retained",
      },
      {
        id: "d1000000-0000-4000-8000-0000000000a3",
        status: "complete",
        safe_error_code: null,
        deletion_state: "retained",
      },
    ],
    deletions: [
      { id: "e1", completed_at: null },
      { id: "e2", completed_at: "2026-10-01T10:00:00Z" },
    ],
    ...(allowance ? { allowance } : {}),
  };
}

async function mock(page: Page, paused = false) {
  await page.route("**/api/administration", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: payload(paused) })
      : route.fulfill({ json: { ok: true } }),
  );
}

// Scan only once overlays have finished animating in; mid-fade text would
// report a false contrast failure.
const axe = async (page: Page) => {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  return (await new AxeBuilder({ page }).analyze()).violations;
};

test("local synthetic mode explains that administration needs the hosted workspace", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administration", level: 1 }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Administration is not available here" }),
  ).toBeVisible();
  await expect(page.getByText(/hosted Supabase workspace/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await axe(page)).toEqual([]);
});

test("members tab lists people and confirms removal by naming the member", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/admin");
  await expect(page.getByRole("tab", { name: "Members" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send invitation" }),
  ).toBeVisible();
  const rows = page.getByRole("row");
  await expect(rows).toHaveCount(4);
  await expect(page.getByText("Removed", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore access" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Remove access for member 7b2d4e6f/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: /Remove access for member 7b2d4e6f/ }),
  ).toBeVisible();
  expect(await axe(page)).toEqual([]);
  const sent = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/administration"),
  );
  await dialog.getByRole("button", { name: "Remove access" }).click();
  expect((await sent).postDataJSON()).toEqual({
    type: "member",
    userId: reviewerId,
    role: "reviewer",
    active: false,
  });
  await expect(page.getByText("Access removed.")).toBeVisible();
});

test("controls, processing and data tabs render and pass Axe in both themes", async ({
  page,
}) => {
  await mock(page, true);
  await page.goto("/admin");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const name of ["Members", "Controls", "Processing", "Data"]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
      expect(await axe(page), `${name} (${scheme})`).toEqual([]);
    }
  }

  await page.getByRole("tab", { name: "Controls" }).click();
  await expect(
    page.getByRole("switch", { name: "Pause intake and inference" }),
  ).toBeChecked();
  await expect(
    page.getByText("Retention drafts and deletion holds are in the Data tab.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Incident owner role")).toHaveValue(
    "Operations lead",
  );

  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(
    page.getByRole("button", { name: "Process pending files" }),
  ).toBeDisabled();
  await expect(page.getByText(/Processing is paused\./)).toBeVisible();
  await expect(page.getByText("Needs a readable copy")).toBeVisible();
  await expect(page.getByText(/doesn't look like a genuine PDF/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh status" }),
  ).toBeEnabled();

  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.getByLabel("Application ID")).toBeVisible();
  await expect(page.getByLabel("Type DELETE CONTENT")).toBeVisible();
  await expect(page.getByText("1 pending deletion record.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete content" }),
  ).toBeEnabled();
});

test("processing is available when not paused and the tab shows an empty state", async ({
  page,
}) => {
  await page.route("**/api/administration", (route) =>
    route.fulfill({
      json: { ...payload(false), documents: [] },
    }),
  );
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(
    page.getByRole("button", { name: "Process pending files" }),
  ).toBeEnabled();
  await expect(page.getByText(/No documents are waiting/)).toBeVisible();
});

test("shows the monthly allowance state and does not invent usage for legacy data", async ({
  page,
}) => {
  await page.route("**/api/administration", (route) =>
    route.fulfill({
      json: payload(false, {
        period: "2026-10-01",
        used: 80,
        limit: 100,
        remaining: 20,
        state: "near_limit",
      }),
    }),
  );
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(page.getByRole("heading", { name: "Monthly processing allowance" })).toBeVisible();
  await expect(page.getByText("This workspace is nearing its monthly processing allowance.")).toBeVisible();
  await expect(page.getByText("2026-10-01")).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.route("**/api/administration", (route) =>
    route.fulfill({ json: payload(false) }),
  );
  await page.reload();
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(page.getByText("Monthly allowance usage is unavailable.")).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("shows an exhausted allowance without implying spend", async ({ page }) => {
  await page.route("**/api/administration", (route) =>
    route.fulfill({
      json: payload(false, {
        period: "2026-10-01",
        used: 120,
        limit: 100,
        remaining: 0,
        state: "exhausted",
      }),
    }),
  );
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(page.getByText("This workspace has used its monthly processing allowance.")).toBeVisible();
  await expect(page.getByText(/not a completed-CV count or spend/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("every administration tab fits a phone without sideways scrolling", async ({
  page,
}) => {
  await mock(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  for (const tab of ["Members", "Controls", "Processing", "Data"]) {
    await page.getByRole("tab", { name: tab }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await axe(page), `${tab} (phone)`).toEqual([]);
    if (tab === "Processing") {
      await page.getByRole("button", { name: "Refresh status" }).focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("table").locator("..")).toBeFocused();
    }
  }
});
