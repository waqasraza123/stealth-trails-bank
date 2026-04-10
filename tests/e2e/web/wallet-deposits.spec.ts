import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { customerUser, mockWebApi, seedCustomerSession } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("submits a valid deposit request and shows the tracker state", async ({
  page,
  context
}) => {
  await context.grantPermissions(["clipboard-write", "clipboard-read"]);
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.getByRole("button", { name: "Hide QR" })).toBeVisible();
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Deposit address copied")).toBeVisible();

  await page.locator("#deposit-asset").selectOption("ETH");
  await page.locator("#deposit-amount").fill("1.25");

  const requestPromise = waitForJsonRequest(
    page,
    "/transaction-intents/deposit-requests"
  );
  await page.getByRole("button", { name: "Create deposit request" }).click();

  await expectJsonRequest(requestPromise, {
    assetSymbol: "ETH",
    amount: "1.25"
  });
  await expect(page.getByText("Latest deposit request")).toBeVisible();
  await expect(page.getByText("intent_deposit_created")).toBeVisible();
});

test("blocks invalid deposit amounts before mutation", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.locator("#deposit-amount").fill("abc");
  await page.getByRole("button", { name: "Create deposit request" }).click();

  await expect(page.getByText("Enter a valid positive decimal amount.")).toBeVisible();
});

test("blocks deposits when the managed wallet address is missing", async ({ page }) => {
  await seedCustomerSession(page, {
    user: {
      ...customerUser(),
      ethereumAddress: ""
    }
  });
  await mockWebApi(page);

  await page.goto("/wallet");
  await page.locator("#deposit-amount").fill("1.25");
  await page.getByRole("button", { name: "Create deposit request" }).click();

  await expect(
    page.getByText("Managed wallet address is not available for this account.")
  ).toBeVisible();
});

test("renders degraded supported-asset loading failures", async ({ page }) => {
  await mockWebApi(page, {
    supportedAssets: {
      ok: false,
      message: "Failed to load supported assets."
    }
  });

  await page.goto("/wallet");

  await expect(page.getByText(/Failed to load supported assets/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Create deposit request" })).toBeEnabled();
});

test("surfaces deposit API failures", async ({ page }) => {
  await mockWebApi(page, {
    deposit: {
      ok: false,
      statusCode: 422,
      message: "Deposit request could not be recorded."
    }
  });

  await page.goto("/wallet");
  await page.locator("#deposit-amount").fill("1.25");
  await page.getByRole("button", { name: "Create deposit request" }).click();

  await expect(
    page.getByRole("main").getByText("Deposit request could not be recorded.")
  ).toBeVisible();
});

test("renders safe empty states when no supported assets exist", async ({ page }) => {
  await mockWebApi(page, {
    supportedAssets: {
      data: {
        assets: []
      }
    }
  });

  await page.goto("/wallet");

  await expect(page.locator("#deposit-asset")).toHaveValue("");
  await expect(page.locator("#withdraw-asset")).toHaveValue("");
});
