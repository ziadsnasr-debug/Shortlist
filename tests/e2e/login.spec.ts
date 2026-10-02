import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The e2e server runs local-synthetic with LOCAL_AUTH_BYPASS=false, so /login renders.
for (const scheme of ["light", "dark"] as const) {
  test(`sign-in step is labelled, has one landmark and one heading, and passes Axe in ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test("login layout holds at phone and desktop widths", async ({ page }) => {
  await page.goto("/login");
  for (const width of [320, 390, 899, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByRole("main")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.getByText("Evidence first. You decide.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByText("Evidence first. You decide.")).toBeHidden();
  // The synthetic-data notice stays visible at every width.
  await expect(
    page.getByText(/synthetic proof of concept/).last(),
  ).toBeVisible();
});

test("mfa steps use one six digit input, accept pasted codes and never auto-submit", async ({
  page,
}) => {
  let verifyCalls = 0;
  await page.route("**/api/auth", async (route) => {
    const body = route.request().postDataJSON();
    if (body.type === "login")
      return route.fulfill({ json: { factorId: null } });
    if (body.type === "enroll")
      return route.fulfill({
        json: {
          factorId: "00000000-0000-4000-8000-000000000000",
          qr: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200"/></svg>',
          secret: "ABCDEFGHJKLMNOPQ",
        },
      });
    verifyCalls++;
    return route.fulfill({
      status: 401,
      json: {
        error: "Authentication failed. Check your invitation and credentials.",
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("a@example.com");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Set up authenticator" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.getByAltText("Authenticator setup QR")).toBeVisible();
  await page.getByText("Can't scan? Enter this key manually").click();
  await expect(page.getByText("ABCD EFGH JKLM NOPQ")).toBeVisible();

  const code = page.getByLabel("Six digit authenticator code");
  await expect(code).toHaveCount(1);
  await code.pressSequentially("12a3-4 5b6");
  await expect(code).toHaveValue("123456");
  await code.fill("");
  await code.focus();
  await page.evaluate(() => {
    const input = document.getElementById("code") as HTMLInputElement;
    const data = new DataTransfer();
    data.setData("text", "987 654");
    input.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(code).toHaveValue("987654");
  await page.waitForTimeout(400);
  expect(verifyCalls).toBe(0);

  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "didn't match" }),
  ).toBeVisible();
  expect(verifyCalls).toBe(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
