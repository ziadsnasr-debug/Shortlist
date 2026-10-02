import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("retention drafts never enable deletion; holds are explicit and refresh safely", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  const state = {
    policy: null as null | {
      version: number;
      proposedDays: number;
      automationEnabled: false;
    },
    preview: {
      status: "not_configured",
      eligibleCount: 0,
      heldCount: 0,
      candidates: [],
    },
    holds: [] as {
      id: string;
      scope: string;
      applicationId: null;
      reasonCode: string;
      active: boolean;
      createdAt: string;
      releasedAt: null;
    }[],
  };
  await page.route("**/api/administration", (route) =>
    route.fulfill({
      json: {
        settings: { paused: false, retentionDays: null, incidentOwner: "" },
        members: [],
        documents: [],
        deletions: [],
        processing: {
          total: 0,
          awaiting_upload: 0,
          queued_or_processing: 0,
          ready: 0,
          attention: 0,
        },
      },
    }),
  );
  await page.route("**/api/retention", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (body.action === "draft_policy") {
        state.policy = {
          version: 1,
          proposedDays: body.proposedDays,
          automationEnabled: false,
        };
        state.preview.status = "hypothetical";
      }
      if (body.action === "place_hold")
        state.holds.push({
          id: "hold-1",
          scope: "workspace",
          applicationId: null,
          reasonCode: body.reasonCode,
          active: true,
          createdAt: new Date().toISOString(),
          releasedAt: null,
        });
      if (body.action === "release_hold") state.holds[0].active = false;
      return route.fulfill({ json: { ok: true } });
    }
    await route.fulfill({ json: state });
  });
  await page.goto("/admin");
  await expect(
    page.getByText("No hypothetical period configured."),
  ).toBeVisible();
  await expect(
    page.getByText("Automatic deletion is disabled.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Hypothetical retention days").fill("90");
  await page.getByRole("button", { name: "Save preview draft" }).click();
  await expect(
    page.getByText("No content will be deleted.", { exact: false }),
  ).toBeVisible();
  expect(requests[0]).toEqual({
    action: "draft_policy",
    proposedDays: 90,
    startEvent: "batch_finalised_at",
  });
  await page.getByRole("button", { name: "Place deletion hold" }).click();
  await expect(
    page.getByRole("button", { name: "Release hold" }),
  ).toBeVisible();
  expect(requests[1]).toEqual({
    action: "place_hold",
    scope: "workspace",
    reasonCode: "legal",
  });
  await page.getByRole("button", { name: "Release hold" }).click();
  await expect(page.getByText("No active deletion holds.")).toBeVisible();
  expect(requests[2]).toEqual({ action: "release_hold", holdId: "hold-1" });
  expect(requests.every((r) => !("automationEnabled" in r))).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
