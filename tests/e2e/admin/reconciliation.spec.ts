import { expect, test } from "@playwright/test";
import { mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the mismatch workspace and locks actions when nothing is selected", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/reconciliation");

  await expect(page).toHaveURL(/mismatch=mismatch_1/);
  await expect(page.getByText("Mismatch workspace")).toBeVisible();
  await expect(page.getByText("mismatch_1").first()).toBeVisible();
});

test("dispatches each governed reconciliation action", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/reconciliation");
  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());

  await page
    .getByRole("button", { name: "Replay confirm" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Replay confirm requested.")).toBeVisible();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Replay settle" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Replay settle requested.")).toBeVisible();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Open review case" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Review case opened for mismatch.")).toBeVisible();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Repair balance", exact: true })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Balance repair requested.")).toBeVisible();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Dismiss mismatch" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Mismatch dismissed.")).toBeVisible();
});

test("shows unavailable state when mismatch or run feeds fail", async ({ page }) => {
  await mockAdminApi(page, {
    reconciliationMismatches: {
      ok: false,
      statusCode: 500,
      message: "Reconciliation data unavailable."
    }
  });

  await page.goto("/reconciliation");

  await expect(page.getByText("Reconciliation data unavailable")).toBeVisible();
});
