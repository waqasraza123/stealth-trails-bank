import { expect, test } from "@playwright/test";

const liveBaseUrl =
  process.env.PLAYWRIGHT_LIVE_ADMIN_API_BASE_URL ?? "http://127.0.0.1:9101";
const liveOperatorId = process.env.PLAYWRIGHT_LIVE_ADMIN_OPERATOR_ID;
const liveOperatorApiKey = process.env.PLAYWRIGHT_LIVE_ADMIN_API_KEY;
const liveOperatorRole =
  process.env.PLAYWRIGHT_LIVE_ADMIN_OPERATOR_ROLE ?? "operations_admin";

test("boots the live admin stack, saves operator session, and renders operations", async ({
  page
}) => {
  test.skip(
    !liveOperatorId || !liveOperatorApiKey,
    "Live admin smoke credentials are not configured."
  );

  await page.goto("/");
  await expect(page).toHaveURL(/\/operations$/);

  await page.getByLabel("API Base URL").fill(liveBaseUrl);
  await page.getByLabel("Operator ID").fill(liveOperatorId!);
  await page.getByLabel("Operator Role").selectOption(liveOperatorRole);
  await page.getByLabel("Operator API Key").fill(liveOperatorApiKey!);
  await page.getByRole("button", { name: "Save Session" }).click();

  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
});
