import { expect, test } from "@playwright/test";
import { mockWebApi, seedCustomerSession, seedWebLocale } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("filters transaction history by reference and address", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/transactions");
  await page.getByPlaceholder("Search by reference or address...").fill("0fed");

  await expect(page.getByText("-10 USDC")).toBeVisible();
  await expect(page.getByText("+1.25 ETH")).toHaveCount(0);
  await expect(page.locator("bdi").filter({ hasText: "0x0000000000000000000000000000000000000fed" })).toBeVisible();
});

test("combines type and status filters", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/transactions");
  await page.locator("select").nth(0).selectOption("Withdrawal");
  await page.locator("select").nth(1).selectOption("Complete");

  await expect(page.getByText("-10 USDC")).toBeVisible();
  await expect(page.getByText("+1.25 ETH")).toHaveCount(0);
});

test("renders an empty result state when filters match nothing", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/transactions");
  await page.getByPlaceholder("Search by reference or address...").fill("not-found");

  await expect(
    page.getByText("No transactions found matching your filters.")
  ).toBeVisible();
});

test("preserves the shell when history loading fails", async ({ page }) => {
  await mockWebApi(page, {
    history: {
      ok: false,
      message: "Failed to load transaction history."
    }
  });

  await page.goto("/transactions");

  await expect(page.getByRole("heading", { name: "Money movement history" })).toBeVisible();
  await expect(page.getByText(/Failed to load transaction history/i)).toBeVisible();
});

test("opens the detail drawer with timeline and reference data", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/transactions");
  await page.getByRole("button", { name: "Open" }).first().click();

  await expect(page.getByText("Internal reference")).toBeVisible();
  await expect(page.getByText("Chain hash")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByText("intent_deposit_1")).toBeVisible();
});

test("keeps references bidi-safe in RTL mode", async ({ page }) => {
  await seedWebLocale(page, "ar");
  await mockWebApi(page);

  await page.goto("/transactions");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("bdi").first()).toContainText("0x");
});
