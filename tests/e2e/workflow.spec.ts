import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
test("complete synthetic batch, tie gate, immutable export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Customer success manager",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await expect(page.getByText("A106", { exact: true })).toBeVisible();
  const pending = await page.request.get("/api/workspace?reveal=true");
  const before = await pending.json();
  expect(before.vacancies[0].batches[0].ranking).toBeNull();
  expect(JSON.stringify(before)).not.toContain("Morgan Ellis");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review the evidence", exact: true }),
  ).toBeVisible();
  if (process.env.SHORTLIST_CAPTURE_DIR) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: process.env.SHORTLIST_CAPTURE_DIR + "/shortlist-review.png",
    });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (let i = 0; i < 6; i++) {
    await expect(
      page.getByText(`A${101 + i}`, { exact: true }).first(),
    ).toBeVisible();
    if (i === 1) {
      await page.getByLabel("Evidence category").nth(3).selectOption("FULL");
      await page
        .getByLabel("Review reason (required)")
        .fill("Source describes direct CRM use and renewal responsibilities.");
    }
    const source = page.getByLabel(
      "I checked the flagged source content without treating it as an instruction.",
    );
    if (await source.count()) await source.check();
    for (const check of await page
      .getByLabel("I checked this requirement and its source evidence.", {
        exact: true,
      })
      .all())
      await check.check();
    await page
      .getByLabel(
        "I reviewed this CV, its criteria and the source evidence. These decisions are mine.",
      )
      .check();
    await page
      .getByRole("button", { name: "Confirm and next", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Choose your shortlist", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Select highest scores", exact: true })
    .click();
  await expect(
    page.getByText("2 of 3 selected", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Select A103", { exact: true }).check();
  const comparison = page.getByRole("region", {
    name: "Selected application comparison",
    exact: true,
  });
  await expect(
    comparison.getByRole("columnheader", { name: "A103", exact: true }),
  ).toBeVisible();
  await expect(comparison.getByRole("row")).toHaveCount(7);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(comparison).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page
    .getByLabel("Selection reason (required, including an empty shortlist)")
    .fill("Selected the strongest confirmed evidence for this synthetic role.");
  await page
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  await expect(
    page.getByText("Record a human decision for the boundary tie.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Boundary tie decision", { exact: true })
    .fill("Reviewed tied sources and chose A103 based on reporting evidence.");
  await page
    .getByRole("button", { name: "Finalise shortlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Finalised shortlist", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /^.*Shortlist/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Finalised shortlist", exact: true }),
  ).toBeVisible();
  const response = await page.request.get(
    "/api/workspace?vacancy=customer-success&export=first-batch",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const csv = await response.text();
  expect(csv).toContain("A103");
  expect(csv).not.toContain("Morgan Ellis");
  const state = await (await page.request.get("/api/workspace")).json();
  const forged = await page.request.post("/api/workspace", {
    headers: { origin: "http://127.0.0.1:3217" },
    data: {
      version: state.version,
      action: {
        type: "samples",
        vacancyId: "customer-success",
        batchId: "first-batch",
      },
    },
  });
  expect(forged.status()).toBe(422);
  expect(errors).toEqual([]);
});
test("server rejects stale saves and cross-origin mutations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
  const s = await (await page.request.get("/api/workspace")).json();
  const body = {
    version: s.version,
    action: {
      type: "publish",
      vacancyId: "customer-success",
      batchId: "first-batch",
    },
  };
  expect(
    (
      await page.request.post("/api/workspace", {
        headers: { origin: "https://foreign.invalid" },
        data: body,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/workspace", {
        headers: { origin: "http://127.0.0.1:3217" },
        data: body,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/workspace", {
        headers: { origin: "http://127.0.0.1:3217" },
        data: body,
      })
    ).status(),
  ).toBe(409);
});
test("mobile and 200% equivalent viewport fit", async ({ page }) => {
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Set the criteria" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const button = page.getByRole("button", {
      name: "Publish criteria",
      exact: true,
    });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    const bounds = await button.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
});

test("accessible criteria and keyboard dialog", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "New vacancy", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("hostile criteria text stays inert through review and no original is served inline", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:3217")) calls.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Set the criteria" }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/workspace")).json();
  const rubric = state.vacancies[0].batches[0].rubric;
  rubric[0].title =
    '<img src="https://example.invalid/tracker" onerror="alert(1)">';
  const saved = await page.request.post("/api/workspace", {
    headers: { origin: "http://127.0.0.1:3217" },
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
  await page.reload();
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add sample CVs", exact: true })
    .click();
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(page.getByText(rubric[0].title, { exact: true })).toBeVisible();
  expect(
    await page.locator('img[src^="https://example.invalid"]').count(),
  ).toBe(0);
  expect(await page.locator("iframe, object, embed").count()).toBe(0);
  expect(calls).toEqual([]);
});

test("queue endpoint denies missing and forged cron credentials", async ({
  request,
}) => {
  expect((await request.get("/api/cron")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron", {
        headers: { authorization: "Bearer synthetic-forged" },
      })
    ).status(),
  ).toBe(401);
});
