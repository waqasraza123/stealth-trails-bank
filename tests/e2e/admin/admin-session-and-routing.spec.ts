import { expect, test } from "@playwright/test";
import { mockAdminApi, seedAdminLocale, seedOperatorSession } from "../support/admin";

test("shows the credentials-required fallback when no operator session is configured", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/");

  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByText("Credentials required")).toBeVisible();
});

test("saves the operator session, persists Arabic RTL state, and restores after reload", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/");
  await page.getByRole("button", { name: "العربية" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByLabel("عنوان API الأساسي").fill("http://127.0.0.1:9101");
  await page.getByLabel("معرّف المشغل").fill("ops_e2e");
  await page.getByLabel("مفتاح API للمشغل").fill("local-dev-operator-key");
  await page.getByRole("button", { name: "حفظ الجلسة" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() =>
        window.localStorage.getItem("stealth-trails-bank.admin.operator-session")
      )
    )
    .toContain("\"operatorId\":\"ops_e2e\"");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("معرّف المشغل")).toHaveValue("ops_e2e");
});

test("redirects to operations by default and keeps left-rail navigation deep-linkable", async ({
  page
}) => {
  await seedOperatorSession(page);
  await seedAdminLocale(page, "en");
  await mockAdminApi(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/operations$/);

  await page.getByRole("link", { name: "Queues" }).click();
  await expect(page).toHaveURL(/\/queues\?reviewCase=review_case_1$/);

  await page.getByRole("link", { name: "Accounts & Reviews" }).click();
  await expect(page).toHaveURL(/\/accounts\?incident=incident_1$/);

  await page.reload();
  await expect(page).toHaveURL(/\/accounts\?incident=incident_1$/);
});
