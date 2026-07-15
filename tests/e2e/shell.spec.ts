import { expect, test } from "@playwright/test";

test("loads the mobile app shell", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle("Scram-Bo");
  await expect(page.getByLabel("Scram-Bo home")).toBeVisible();
});
