import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { buildWebScenario, mockWebApi, seedCustomerSession } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("keeps yield actions policy-gated when execution is unavailable", async ({
  page
}) => {
  await mockWebApi(page);

  await page.goto("/yield");

  await expect(
    page.getByRole("heading", { name: "Yield and infrastructure" })
  ).toBeVisible();
  await expect(page.getByText("Execution remains policy-gated")).toBeVisible();
  await expect(page.getByRole("button", { name: "Stake ETH" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Withdraw stake" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Claim rewards" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Emergency withdrawal" })).toBeDisabled();
});

test("submits all execution-enabled yield actions", async ({ page }) => {
  await mockWebApi(page, {
    stakingSnapshot: {
      data: {
        ...buildWebScenario("happy").stakingSnapshot.data!,
        execution: {
          available: true,
          reasonCode: null,
          message: "Managed staking execution is enabled."
        }
      }
    }
  });

  await page.goto("/yield");

  await page.getByLabel("Deposit amount").fill("1.2");
  const depositRequest = waitForJsonRequest(page, "/staking/deposit");
  await page.getByRole("button", { name: "Stake ETH" }).click();
  await expectJsonRequest(depositRequest, { poolId: 11, amount: "1.2" });
  await expect(page.getByText(/Transaction hash:/i)).toBeVisible();

  await page.getByLabel("Withdrawal amount").fill("0.5");
  const withdrawRequest = waitForJsonRequest(page, "/staking/withdraw");
  await page.getByRole("button", { name: "Withdraw stake" }).click();
  await expectJsonRequest(withdrawRequest, { poolId: 11, amount: "0.5" });

  const claimRequest = waitForJsonRequest(page, "/staking/claim-reward");
  await page.getByRole("button", { name: "Claim rewards" }).click();
  await expectJsonRequest(claimRequest, { poolId: 11 });

  const emergencyRequest = waitForJsonRequest(page, "/staking/emergency-withdraw");
  await page.getByRole("button", { name: "Emergency withdrawal" }).click();
  await expectJsonRequest(emergencyRequest, { poolId: 11 });
});

test("blocks invalid yield amounts before mutation", async ({ page }) => {
  await mockWebApi(page, {
    stakingSnapshot: {
      data: {
        ...buildWebScenario("happy").stakingSnapshot.data!,
        execution: {
          available: true,
          reasonCode: null,
          message: "Managed staking execution is enabled."
        }
      }
    }
  });

  await page.goto("/yield");

  await page.getByLabel("Deposit amount").fill("invalid");
  await page.getByRole("button", { name: "Stake ETH" }).click();
  await expect(page.getByText("Invalid stake amount", { exact: true })).toBeVisible();

  await page.getByLabel("Withdrawal amount").fill("0");
  await page.getByRole("button", { name: "Withdraw stake" }).click();
  await expect(page.getByText("Invalid withdrawal amount", { exact: true })).toBeVisible();
});

test("surfaces backend failures for each yield action", async ({ page }) => {
  await mockWebApi(page, {
    stakingSnapshot: {
      data: {
        ...buildWebScenario("happy").stakingSnapshot.data!,
        execution: {
          available: true,
          reasonCode: null,
          message: "Managed staking execution is enabled."
        }
      }
    },
    stakingDeposit: {
      ok: false,
      statusCode: 500,
      message: "Deposit failed."
    },
    stakingWithdraw: {
      ok: false,
      statusCode: 500,
      message: "Withdraw failed."
    },
    stakingClaimReward: {
      ok: false,
      statusCode: 500,
      message: "Claim failed."
    },
    stakingEmergencyWithdraw: {
      ok: false,
      statusCode: 500,
      message: "Emergency withdraw failed."
    }
  });

  await page.goto("/yield");

  await page.getByLabel("Deposit amount").fill("1");
  await page.getByRole("button", { name: "Stake ETH" }).click();
  await expect(page.getByText("Deposit failed.", { exact: true })).toBeVisible();

  await page.getByLabel("Withdrawal amount").fill("0.5");
  await page.getByRole("button", { name: "Withdraw stake" }).click();
  await expect(page.getByText("Withdraw failed.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Claim rewards" }).click();
  await expect(page.getByText("Claim failed.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Emergency withdrawal" }).click();
  await expect(
    page.getByText("Emergency withdraw failed.", { exact: true })
  ).toBeVisible();
});

test("renders limited-read warnings when the read model is unavailable", async ({
  page
}) => {
  await mockWebApi(page, {
    stakingSnapshot: {
      data: {
        ...buildWebScenario("happy").stakingSnapshot.data!,
        readModel: {
          available: false,
          message: "Read-only posture is active while projections catch up."
        }
      }
    }
  });

  await page.goto("/yield");

  await expect(page.getByText("Read-only posture is active while projections catch up.")).toBeVisible();
});

test("preserves the shell when the yield feed fails", async ({ page }) => {
  await mockWebApi(page, {
    stakingSnapshot: {
      ok: false,
      statusCode: 500,
      message: "Failed to load staking snapshot."
    }
  });

  await page.goto("/yield");

  await expect(
    page.getByRole("heading", { name: "Yield and infrastructure" })
  ).toBeVisible();
  await expect(page.getByText("Failed to load staking snapshot.")).toBeVisible();
});
