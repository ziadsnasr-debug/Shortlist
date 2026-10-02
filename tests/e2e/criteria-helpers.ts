import { expect, type Page } from "@playwright/test";

/** Publishes the criteria through the confirmation dialog. */
export async function publishCriteria(page: Page) {
  await page
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Publish these criteria?" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Publish criteria", exact: true })
    .click();
}
