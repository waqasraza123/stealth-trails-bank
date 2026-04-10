import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { customerUser, mockWebApi, seedCustomerSession, seedWebLocale } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("submits a valid withdrawal request and shows the review tracker", async ({
  page
}) => {
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.locator("#withdraw-asset").selectOption("USDC");
  await page.getByLabel("Destination address").fill(
    "0x0000000000000000000000000000000000000abc"
  );
  await page.locator("#withdraw-amount").fill("25");

  const requestPromise = waitForJsonRequest(
    page,
    "/transaction-intents/withdrawal-requests"
  );
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expectJsonRequest(requestPromise, {
    assetSymbol: "USDC",
    amount: "25",
    destinationAddress: "0x0000000000000000000000000000000000000abc"
  });
  await expect(page.getByText("Latest withdrawal request")).toBeVisible();
  await expect(page.getByText("intent_withdrawal_created")).toBeVisible();
});

test("blocks invalid EVM destination addresses", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.getByLabel("Destination address").fill("invalid");
  await page.locator("#withdraw-amount").fill("25");
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expect(
    page.getByText("Destination address must be a valid EVM address.")
  ).toBeVisible();
});

test("blocks self-directed withdrawals", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.getByLabel("Destination address").fill(customerUser().ethereumAddress);
  await page.locator("#withdraw-amount").fill("1");
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expect(
    page.getByText("Destination address must be different from your managed wallet address.")
  ).toBeVisible();
});

test("blocks withdrawals that exceed the available balance", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.locator("#withdraw-asset").selectOption("USDC");
  await page.getByLabel("Destination address").fill(
    "0x0000000000000000000000000000000000000abc"
  );
  await page.locator("#withdraw-amount").fill("200");
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expect(page.getByText(/Requested amount exceeds the available balance/)).toBeVisible();
});

test("blocks unsupported or assetless withdrawal requests", async ({ page }) => {
  await mockWebApi(page, {
    supportedAssets: {
      data: {
        assets: []
      }
    }
  });

  await page.goto("/wallet");
  await page.getByLabel("Destination address").fill(
    "0x0000000000000000000000000000000000000abc"
  );
  await page.locator("#withdraw-amount").fill("25");
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expect(
    page.getByText("Select an asset before creating a withdrawal request.")
  ).toBeVisible();
});

test("preserves the shell and blocks unsafe submits when balances fail to load", async ({
  page
}) => {
  await mockWebApi(page, {
    balances: {
      ok: false,
      message: "Failed to load customer balances."
    }
  });

  await page.goto("/wallet");
  await expect(page.getByRole("heading", { name: "Managed wallet operations" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Failed to load customer balances.");

  await page.locator("#withdraw-asset").selectOption("USDC");
  await page.getByLabel("Destination address").fill(
    "0x0000000000000000000000000000000000000abc"
  );
  await page.locator("#withdraw-amount").fill("1");
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expect(page.getByText(/Requested amount exceeds the available balance/)).toBeVisible();
});

test("surfaces withdrawal API failures", async ({ page }) => {
  await mockWebApi(page, {
    withdrawal: {
      ok: false,
      statusCode: 422,
      message: "Withdrawal request could not be created."
    }
  });

  await page.goto("/wallet");
  await page.getByLabel("Destination address").fill(
    "0x0000000000000000000000000000000000000abc"
  );
  await page.locator("#withdraw-amount").fill("1");
  await page.getByRole("button", { name: "Create withdrawal request" }).click();

  await expect(
    page.getByRole("main").getByText("Withdrawal request could not be created.")
  ).toBeVisible();
});

test("keeps addresses bidi-safe under RTL", async ({ page }) => {
  await seedWebLocale(page, "ar");
  await mockWebApi(page);

  await page.goto("/wallet");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.locator("bdi").filter({ hasText: "0x1111222233334444555566667777888899990000" })
  ).toBeVisible();
});
