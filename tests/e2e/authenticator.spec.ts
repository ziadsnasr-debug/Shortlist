import { test, expect } from "@playwright/test";

test("authenticator QR renders and manual setup remains available", async ({ page }) => {
  // Fictional fixture, never an actual enrolled factor or private credential.
  const qr = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="black"/></svg>';
  await page.route("**/api/auth", async (route) => {
    const { type } = route.request().postDataJSON();
    await route.fulfill({ json: type === "login" ? { factorId: null } : {
      factorId: "00000000-0000-4000-8000-000000000001", qr, secret: "FICTIONALSETUPKEY",
    } });
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("fictional@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fictional-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const image = page.getByAltText("Authenticator setup QR");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(200);
  await page.getByText("Can’t scan? Enter a setup key instead").click();
  await expect(page.getByText("FICTIONALSETUPKEY")).toBeVisible();
  await expect(page.getByLabel("Six digit authenticator code")).toBeVisible();
});
