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
  await expect(page).toHaveURL(/evidence=evidence_/);
  await expect(page.getByText("Selected evidence")).toBeVisible();
  await expect(page.getByText("Selected approval")).toBeVisible();
  await expect(page.getByText("Api Rollback Drill").first()).toBeVisible();
  await expect(page.getByText("Stale evidence requires attention")).toBeVisible();
});

test("records evidence and requests governed approval from the launch workspace", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/launch-readiness");

  await page.getByLabel("Evidence type").selectOption("secret_handling_review");
  await page.getByLabel("Evidence environment").selectOption("production_like");
  await page
    .getByLabel("Evidence release identifier")
    .fill("launch-2026.04.13.1");
  await page
    .getByLabel("Evidence summary")
    .fill("Secret handling review completed for the launch roster.");
  await page
    .getByLabel("Evidence note")
    .fill("Reference: ticket/SEC-42");
  await page
    .getByLabel("Evidence links")
    .fill("ticket/SEC-42\nticket/SEC-42#launch-roster");
  await page
    .getByText(
      "I verified the environment label, summary, and linked evidence before recording this proof."
    )
    .click();

  const recordEvidenceRequest = waitForJsonRequest(
    page,
    "/release-readiness/internal/evidence"
  );
  await page.getByRole("button", { name: "Record evidence" }).click();
  await expectJsonRequest(recordEvidenceRequest, {
    evidenceType: "secret_handling_review",
    environment: "production_like",
    status: "passed",
    releaseIdentifier: "launch-2026.04.13.1",
    summary: "Secret handling review completed for the launch roster.",
    note: "Reference: ticket/SEC-42",
    evidenceLinks: ["ticket/SEC-42", "ticket/SEC-42#launch-roster"]
  });
  await expect(page.getByText("Evidence recorded.")).toBeVisible();

  await page
    .getByLabel("Approval release identifier")
    .fill("launch-2026.04.13.1");
  await page.getByLabel("Approval environment").selectOption("production_like");
  await page
    .getByLabel("Approval summary")
    .fill("All accepted proof is current and the release candidate is ready for dual control.");
  await page
    .getByLabel("Approval request note")
    .fill("Evidence reviewed from the operator console.");
  await page
    .getByRole("checkbox", { name: "Security configuration complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Access and governance complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Data and recovery complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Platform health complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Functional proof complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Contract and chain proof complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Final signoff complete" })
    .check();
  await page
    .getByRole("checkbox", { name: "Residual risks explicitly accepted" })
    .check();
  await page
    .getByText(
      "I verified the checklist attestations and current evidence before requesting approval."
    )
    .click();

  const requestApprovalRequest = waitForJsonRequest(
    page,
    "/release-readiness/internal/approvals"
  );
  await page.getByRole("button", { name: "Request approval" }).click();
  await expectJsonRequest(requestApprovalRequest, {
    releaseIdentifier: "launch-2026.04.13.1",
    environment: "production_like",
    summary:
      "All accepted proof is current and the release candidate is ready for dual control.",
    requestNote: "Evidence reviewed from the operator console.",
    securityConfigurationComplete: true,
    accessAndGovernanceComplete: true,
    dataAndRecoveryComplete: true,
    platformHealthComplete: true,
    functionalProofComplete: true,
    contractAndChainProofComplete: true,
    finalSignoffComplete: true,
    unresolvedRisksAccepted: true
  });
  await expect(page.getByText("Approval request created.")).toBeVisible();
  await expect(page).toHaveURL(/approval=approval_2/);
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
  await page
    .getByText("I reviewed failed checks, stale evidence, and open blockers before deciding.")
    .click();
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
