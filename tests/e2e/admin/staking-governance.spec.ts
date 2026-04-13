import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads staking governance detail and can filter to retryable execution failures", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/staking-governance");

  await expect(page).toHaveURL(/request=staking_governance_request_1/);
  await expect(page.getByText("Dual control required")).toBeVisible();
  await expect(page.getByText("Linked pools")).toBeVisible();

  await page.getByLabel("Staking governance status filter").selectOption("execution_failed");
  await page
    .getByRole("button", { name: /staking_governance_request_3/i })
    .click();

  await expect(page).toHaveURL(/request=staking_governance_request_3/);
  await expect(page.getByText("Execution retry available")).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Execution retry available" })
      .getByText("Treasury signer rejected the transaction bundle during submission.")
  ).toBeVisible();
});

test("creates a governed staking request from the operator workspace", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/staking-governance");

  await page.getByLabel("New pool reward rate").fill("11");
  await page
    .getByLabel("Staking governance request note")
    .fill("Treasury requested a new managed yield pool for the next release train.");
  await page
    .getByText(
      "I verified the reward-rate intent, operator ownership, and execution impact before creating this governed request."
    )
    .click();

  const createRequest = waitForJsonRequest(
    page,
    "/staking/internal/pool-governance-requests"
  );
  await page.getByRole("button", { name: "Create governance request" }).click();
  await expectJsonRequest(createRequest, {
    rewardRate: 11,
    requestNote: "Treasury requested a new managed yield pool for the next release train."
  });

  await expect(page.getByText("Governance request created.")).toBeVisible();
  await expect(page).toHaveURL(/request=staking_governance_request_6/);
});

test("approves and executes a staking governance request through governed controls", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/staking-governance");

  await page
    .getByLabel("Staking governance operator note")
    .fill("Governed approval recorded after treasury review.");
  await page
    .getByText(
      "I reviewed requester separation, reward-rate intent, and current pool state before taking a governed action."
    )
    .click();

  const approveRequest = waitForJsonRequest(
    page,
    "/staking/internal/pool-governance-requests/staking_governance_request_1/approve"
  );
  await page.getByRole("button", { name: "Approve request" }).click();
  await expectJsonRequest(approveRequest, {
    approvalNote: "Governed approval recorded after treasury review."
  });
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByText("Ready for execution")).toBeVisible();

  await page
    .getByLabel("Staking governance operator note")
    .fill("Executed after treasury signer verification.");
  await page
    .getByText(
      "I reviewed requester separation, reward-rate intent, and current pool state before taking a governed action."
    )
    .click();

  const executeRequest = waitForJsonRequest(
    page,
    "/staking/internal/pool-governance-requests/staking_governance_request_1/execute"
  );
  await page.getByRole("button", { name: "Execute pool creation" }).click();
  await expectJsonRequest(executeRequest, {
    executionNote: "Executed after treasury signer verification."
  });
  await expect(page.getByText("Pool execution recorded.")).toBeVisible();
  await expect(page.getByText("Execution completed")).toBeVisible();
  await expect(
    page.getByText(
      "0xpool1111222233334444555566667777888899990000aaaabbbbccccdddd0001"
    )
  ).toBeVisible();
});

test("rejects a staking governance request and preserves the selected detail", async ({
  page
}) => {
  await mockAdminApi(page);

  await page.goto("/staking-governance");

  await page
    .getByLabel("Staking governance operator note")
    .fill("Reward rate should remain below the approved treasury threshold.");
  await page
    .getByText(
      "I reviewed requester separation, reward-rate intent, and current pool state before taking a governed action."
    )
    .click();

  const rejectRequest = waitForJsonRequest(
    page,
    "/staking/internal/pool-governance-requests/staking_governance_request_1/reject"
  );
  await page.getByRole("button", { name: "Reject request" }).click();
  await expectJsonRequest(rejectRequest, {
    rejectionNote: "Reward rate should remain below the approved treasury threshold."
  });

  await expect(page.getByText("Request rejected.")).toBeVisible();
  await expect(page.getByText("Request closed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected request" })).toBeVisible();
});

test("surfaces governed action failures without dropping the selected staking request", async ({
  page
}) => {
  await mockAdminApi(page, {
    approveStakingGovernanceRequest: {
      ok: false,
      statusCode: 500,
      message: "Failed to approve staking request."
    }
  });

  await page.goto("/staking-governance");

  await page
    .getByText(
      "I reviewed requester separation, reward-rate intent, and current pool state before taking a governed action."
    )
    .click();
  await page.getByRole("button", { name: "Approve request" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to approve staking request.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected request" })).toBeVisible();
});
