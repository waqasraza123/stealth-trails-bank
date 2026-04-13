import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("requests evidence and approves a lending application", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/lending");

  await expect(page).toHaveURL(/loanApplication=loan_application_1/);
  await page.locator("textarea.admin-textarea").fill("Bank statement verified.");

  const requestEvidence = waitForJsonRequest(
    page,
    "/loans/internal/applications/loan_application_1/request-more-evidence"
  );
  await page.getByRole("button", { name: "Request evidence" }).click();
  await expectJsonRequest(requestEvidence, {
    note: "Bank statement verified."
  });
  await expect(page.getByText("Evidence request recorded.")).toBeVisible();

  await page.locator("textarea.admin-textarea").fill("Collateral source verified.");
  const approveRequest = waitForJsonRequest(
    page,
    "/loans/internal/applications/loan_application_1/approve"
  );
  await page.getByRole("button", { name: "Approve application" }).click();
  await expectJsonRequest(approveRequest, {
    note: "Collateral source verified."
  });
  await expect(page.getByText("Loan application approved.")).toBeVisible();
});

test("rejects the application and records an account restriction", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/lending");

  await expect(page).toHaveURL(/loanApplication=loan_application_1/);
  await page.locator("textarea.admin-textarea").fill("Income evidence could not be verified.");

  const rejectRequest = waitForJsonRequest(
    page,
    "/loans/internal/applications/loan_application_1/reject"
  );
  await page.getByRole("button", { name: "Reject application" }).click();
  await expectJsonRequest(rejectRequest, {
    note: "Income evidence could not be verified."
  });
  await expect(page.getByText("Loan application rejected.")).toBeVisible();

  await page.locator("textarea.admin-textarea").fill("Restriction placed pending risk review.");
  const restrictRequest = waitForJsonRequest(
    page,
    "/loans/internal/applications/loan_application_1/place-account-restriction"
  );
  await page.getByRole("button", { name: "Restrict account" }).click();
  await expectJsonRequest(restrictRequest, {
    note: "Restriction placed pending risk review.",
    reasonCode: "loan_risk_restriction"
  });
  await expect(page.getByText("Customer account restricted.")).toBeVisible();
});

test("runs the governed liquidation lifecycle and closes the agreement", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/lending");
  await page.getByRole("button", { name: /amina@example\.com/i }).click();

  await expect(page).toHaveURL(/loanAgreement=loan_agreement_1/);
  await page.locator("textarea.admin-textarea").fill("Collateral health breached the operator threshold.");

  const startRequest = waitForJsonRequest(
    page,
    "/loans/internal/agreements/loan_agreement_1/start-liquidation-review"
  );
  await page.getByRole("button", { name: "Start liquidation review" }).click();
  await expectJsonRequest(startRequest, {
    note: "Collateral health breached the operator threshold."
  });
  await expect(page.getByText("Liquidation review started.")).toBeVisible();

  await page.locator("textarea.admin-textarea").fill("Dual control approval recorded.");
  const approveRequest = waitForJsonRequest(
    page,
    "/loans/internal/agreements/loan_agreement_1/approve-liquidation"
  );
  await page.getByRole("button", { name: "Approve liquidation" }).click();
  await expectJsonRequest(approveRequest, {
    note: "Dual control approval recorded."
  });
  await expect(page.getByText("Liquidation approved.")).toBeVisible();

  await page.locator("textarea.admin-textarea").fill("Collateral execution confirmed.");
  const executeRequest = waitForJsonRequest(
    page,
    "/loans/internal/agreements/loan_agreement_1/execute-liquidation"
  );
  await page.getByRole("button", { name: "Execute liquidation" }).click();
  await expectJsonRequest(executeRequest, {
    note: "Collateral execution confirmed."
  });
  await expect(page.getByText("Liquidation executed.")).toBeVisible();

  await page.locator("textarea.admin-textarea").fill("Agreement archived after recovery.");
  const closeRequest = waitForJsonRequest(
    page,
    "/loans/internal/agreements/loan_agreement_1/close"
  );
  await page.getByRole("button", { name: "Close agreement" }).click();
  await expectJsonRequest(closeRequest, {
    note: "Agreement archived after recovery."
  });
  await expect(page.getByText("Loan agreement closed.")).toBeVisible();
});

test("shows inline governed action failures without dropping the workspace", async ({
  page
}) => {
  await mockAdminApi(page, {
    approveLoanApplication: {
      ok: false,
      statusCode: 500,
      message: "Failed to approve loan application."
    }
  });

  await page.goto("/lending");

  await expect(page).toHaveURL(/loanApplication=loan_application_1/);
  await page.getByRole("button", { name: "Approve application" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to approve loan application.")).toBeVisible();
  await expect(page.getByText("loan_application_1")).toBeVisible();
});
