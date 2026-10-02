import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("design gallery renders every primitive with no accessibility violations", async ({
  page,
}) => {
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { level: 1, name: "Design gallery" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("loading button is disabled and marked busy", async ({ page }) => {
  await page.goto("/design");
  const loading = page.getByRole("button", { name: "Saving review" });
  await expect(loading).toBeDisabled();
  await expect(loading).toHaveAttribute("aria-busy", "true");
});

test("sheet opens from the right, closes on Escape and restores focus", async ({
  page,
}) => {
  await page.goto("/design");
  const trigger = page.getByRole("button", { name: "Open sheet" });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Candidate 101" });
  await expect(sheet).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("keyboard focus ring is visible on buttons", async ({ page }) => {
  await page.goto("/design");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const style = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: cs.outlineWidth };
  });
  expect(style.style).toBe("solid");
  expect(style.width).toBe("2px");
});

test("dark theme follows the system and keeps the workspace and gallery accessible", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/", "/design"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
