import { expect, test } from "@playwright/test";

const liveEmail = process.env.PLAYWRIGHT_LIVE_WEB_EMAIL;
const livePassword = process.env.PLAYWRIGHT_LIVE_WEB_PASSWORD;

test("boots the live customer stack and renders a protected route after sign-in", async ({
  page
}) => {
  test.skip(!liveEmail || !livePassword, "Live web smoke credentials are not configured.");

  await page.goto("/auth/sign-in");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await page.getByLabel(/email/i).fill(liveEmail!);
  await page.getByLabel(/password/i).fill(livePassword!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
});
