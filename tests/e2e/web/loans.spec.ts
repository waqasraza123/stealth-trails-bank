import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { mockWebApi, seedCustomerSession } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("previews and submits a managed lending application", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/loans");

  await expect(
    page.getByRole("heading", { name: "Managed lending", exact: true })
  ).toBeVisible();
  const textboxes = page.getByRole("textbox");
  await textboxes.nth(0).fill("12");
  await textboxes.nth(1).fill("1500");
  await textboxes.nth(2).fill("2400");

  const previewRequest = waitForJsonRequest(page, "/loans/me/quote-preview");
  await page.getByRole("button", { name: "Preview quote" }).click();
  await expectJsonRequest(previewRequest, {
    jurisdiction: "usa",
    borrowAssetSymbol: "USDC",
    collateralAssetSymbol: "ETH",
    borrowAmount: "1500",
    collateralAmount: "2400",
    termMonths: "12",
    autopayEnabled: true
  });
  await expect(page.getByText("Total repayable")).toBeVisible();

  await textboxes
    .nth(3)
    .fill("Payroll documentation already uploaded for manual review.");
  await page
    .getByText("I accept the disclosed fixed service fee and non-interest structure")
    .click();

  const submitRequest = waitForJsonRequest(page, "/loans/me/applications");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expectJsonRequest(submitRequest, {
    jurisdiction: "usa",
    borrowAssetSymbol: "USDC",
    collateralAssetSymbol: "ETH",
    borrowAmount: "1500",
    collateralAmount: "2400",
    termMonths: "12",
    autopayEnabled: true,
    acceptServiceFeeDisclosure: true,
    supportNote: "Payroll documentation already uploaded for manual review."
  });
  await expect(
    page.getByRole("status", { name: "Status: submitted for review" }).first()
  ).toBeVisible();
});

test("updates agreement autopay state from the lending workspace", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/loans");

  await expect(page.getByRole("button", { name: "Disable autopay" })).toBeVisible();
  const autopayRequest = waitForJsonRequest(page, "/loans/me/loan_agreement_1/autopay");
  await page.getByRole("button", { name: "Disable autopay" }).click();
  await expectJsonRequest(autopayRequest, {
    policyOverride: false
  });
  await expect(page.getByRole("button", { name: "Enable autopay" })).toBeVisible();
  await expect(
    page.getByText(
      "Autopay is disabled. Ensure managed balances are ready before the next due date."
    )
  ).toBeVisible();
});

test("preserves the lending shell when the dashboard request fails", async ({ page }) => {
  await mockWebApi(page, {
    loansDashboard: {
      ok: false,
      statusCode: 500,
      message: "Failed to load customer loans."
    }
  });

  await page.goto("/loans");

  await expect(
    page.getByRole("heading", { name: "Managed lending", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Failed to load customer loans.")).toBeVisible();
});
