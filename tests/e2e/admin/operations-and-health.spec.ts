import { expect, test } from "@playwright/test";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("renders healthy and warning operational summaries", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/operations");

  await expect(page.getByText("Open alerts")).toBeVisible();
  await expect(page.getByText("Open alerts")).toBeVisible();
  await expect(page.getByText("Queued work")).toBeVisible();
  await expect(page.getByText("Launch gate")).toBeVisible();
  await expect(page.getByText("Queue aging")).toBeVisible();
});

test("renders degraded and blocked emphasis from health and readiness state", async ({
  page
}) => {
  await mockAdminApi(page, buildAdminScenario("degraded"));

  await page.goto("/operations");

  await expect(page.getByText("Launch gate is blocked")).toBeVisible();
  await expect(page.getByText("Queue aging")).toBeVisible();
});

test("shows the unavailable state when operations summaries fail", async ({ page }) => {
  await mockAdminApi(page, {
    operationsStatus: {
      ok: false,
      statusCode: 500,
      message: "Operations overview unavailable."
    }
  });

  await page.goto("/operations");

  await expect(page.getByText("Operations overview unavailable")).toBeVisible();
});
