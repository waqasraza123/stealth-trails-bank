import { expect, test } from "@playwright/test";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the selected review workspace and can start a case", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/queues");

  await expect(page).toHaveURL(/reviewCase=review_case_1/);
  await expect(page.getByText("Case reference")).toBeVisible();
  await expect(page.getByText("review_case_1")).toBeVisible();

  await page
    .getByRole("button", { name: "Start case" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Review case started.")).toBeVisible();
});

test("records notes and clears the note field", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/queues");
  await page.getByLabel("Operator note").fill("Evidence reviewed and queued.");

  const requestPromise = waitForJsonRequest(
    page,
    "/review-cases/internal/review_case_1/notes"
  );
  await page.getByRole("button", { name: "Record note" }).click();

  await expectJsonRequest(requestPromise, {
    note: "Evidence reviewed and queued."
  });
  await expect(page.getByText("Workspace note recorded.")).toBeVisible();
  await expect(page.getByLabel("Operator note")).toHaveValue("");
});

test("requires governed confirmation for release, resolve, and dismiss actions", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/queues");

  await expect(page.getByRole("button", { name: "Request account release review" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resolve case" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Dismiss case" })).toBeDisabled();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Request account release review" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Account release review requested.")).toBeVisible();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Resolve case" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Review case resolved.")).toBeVisible();

  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Dismiss case" })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("Review case dismissed.")).toBeVisible();
});

test("shows inline critical failures while preserving the workspace", async ({ page }) => {
  await mockAdminApi(page, {
    resolveReviewCase: {
      ok: false,
      statusCode: 500,
      message: "Failed to resolve review case."
    }
  });

  await page.goto("/queues");
  await page
    .locator('input[type="checkbox"]')
    .evaluate((element: HTMLInputElement) => element.click());
  await page
    .getByRole("button", { name: "Resolve case" })
    .evaluate((element: HTMLButtonElement) => element.click());

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to resolve review case.")).toBeVisible();
  await expect(page.getByText("review_case_1")).toBeVisible();
});

test("renders the empty pending-release-review state", async ({ page }) => {
  await mockAdminApi(page, buildAdminScenario("empty"));

  await page.goto("/queues");

  await expect(page.getByText("No pending release reviews")).toBeVisible();
});
