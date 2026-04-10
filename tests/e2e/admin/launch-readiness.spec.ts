import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads approval workspace details and stale evidence warnings", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/launch-readiness");

  await expect(page).toHaveURL(/approval=approval_1/);
  await expect(page.getByText("Selected approval")).toBeVisible();
  await expect(page.getByText("rollback_drill").first()).toBeVisible();
});

test("approves and rejects release-readiness items through governed controls", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/launch-readiness");
  await page.getByLabel("Approval note").fill("Latest proof reviewed.");
  await page
    .getByText("I reviewed failed checks, stale evidence, and open blockers before deciding.")
    .click();

  const approveRequest = waitForJsonRequest(
    page,
    "/release-readiness/internal/approvals/approval_1/approve"
  );
  await page.getByRole("button", { name: "Approve release" }).click();
  await expectJsonRequest(approveRequest, {
    approvalNote: "Latest proof reviewed."
  });
  await expect(page.getByText("Approval recorded.")).toBeVisible();

  await page.getByLabel("Approval note").fill("Evidence is stale.");
  await page.getByRole("checkbox").check();
  const rejectRequest = waitForJsonRequest(
    page,
    "/release-readiness/internal/approvals/approval_1/reject"
  );
  await page.getByRole("button", { name: "Reject release" }).click();
  await expectJsonRequest(rejectRequest, {
    rejectionNote: "Evidence is stale."
  });
  await expect(page.getByText("Rejection recorded.")).toBeVisible();
});

test("shows inline approval failures while preserving workspace state", async ({
  page
}) => {
  await mockAdminApi(page, {
    approveRelease: {
      ok: false,
      statusCode: 500,
      message: "Failed to approve release readiness item."
    }
  });

  await page.goto("/launch-readiness");
  await page
    .getByText("I reviewed failed checks, stale evidence, and open blockers before deciding.")
    .click();
  await page.getByRole("button", { name: "Approve release" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to approve release readiness item.")).toBeVisible();
  await expect(page.getByText("approval_1")).toBeVisible();
});

test("keeps governed actions unavailable when no approval is selected", async ({
  page
}) => {
  await mockAdminApi(page, {
    approvals: {
      data: {
        approvals: [],
        limit: 20,
        totalCount: 0
      }
    }
  });

  await page.goto("/launch-readiness");

  await expect(page.getByRole("heading", { name: "Select an approval" })).toBeVisible();
});
