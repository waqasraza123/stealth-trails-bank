import { expect, test } from "@playwright/test";

const adminUrl = "http://127.0.0.1:4174";

test("admin console saves the operator session and persists Arabic rtl shell state", async ({
  page
}) => {
  await page.goto(adminUrl);

  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "وحدة تحكم المشغل" })
  ).toBeVisible();

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
