import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the selected alert workspace and delivery health", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/alerts");

  await expect(page).toHaveURL(/alert=alert_1/);
  await expect(page.getByText("Selected alert")).toBeVisible();
  await expect(page.getByText("Delivery health")).toBeVisible();
});

test("acknowledges, routes, and retries alert deliveries with governed confirmation", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/alerts");
  await page
    .getByText("I reviewed severity, delivery failures, and whether the alert should create review work.")
    .click();

  const acknowledgeRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/acknowledge"
  );
  await page.getByRole("button", { name: "Acknowledge alert" }).click();
  await expectJsonRequest(acknowledgeRequest, {});
  await expect(page.getByText("Alert acknowledged.")).toBeVisible();

  await page.getByRole("checkbox").check();
  const routeRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/route-review-case"
  );
  await page.getByRole("button", { name: "Route to review case" }).click();
  await expectJsonRequest(routeRequest, {});
  await expect(page.getByText("Alert routed to review case.")).toBeVisible();

  await page.getByRole("checkbox").check();
  const retryRequest = waitForJsonRequest(
    page,
    "/operations/internal/alerts/alert_1/retry-deliveries"
  );
  await page.getByRole("button", { name: "Retry deliveries" }).click();
  await expectJsonRequest(retryRequest, {});
  await expect(page.getByText("Delivery retry requested.")).toBeVisible();
});

test("shows inline failures and degraded targets", async ({ page }) => {
  await mockAdminApi(page, {
    acknowledgeAlert: {
      ok: false,
      statusCode: 500,
      message: "Failed to acknowledge alert."
    }
  });

  await page.goto("/alerts");
  await expect(page.getByText("pagerduty-primary")).toBeVisible();
  await expect(page.getByText("Critical targets")).toBeVisible();

  await page
    .getByText("I reviewed severity, delivery failures, and whether the alert should create review work.")
    .click();
  await page.getByRole("button", { name: "Acknowledge alert" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to acknowledge alert.")).toBeVisible();
});

test("keeps controls locked when no alert is selected", async ({ page }) => {
  await mockAdminApi(page, buildAdminScenario("empty"));

  await page.goto("/alerts");

  await expect(page.getByText("No alert selected")).toBeVisible();
});
