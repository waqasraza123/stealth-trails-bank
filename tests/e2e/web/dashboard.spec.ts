import { expect, test } from "@playwright/test";
import { buildWebScenario, mockWebApi, seedCustomerSession, seedWebLocale } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("renders healthy balances and recent activity", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/");

  await expect(
    page.getByRole("main").getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
  await expect(page.getByText("Available assets")).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "100 USDC" }).first()).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expect(page.getByText("Primary delivery target is timing out.")).toHaveCount(0);
  await expect(page.getByText("This reference stays traceable")).toBeVisible();
});

test("renders calm empty states when balances and history are empty", async ({ page }) => {
  await mockWebApi(page, buildWebScenario("empty"));

  await page.goto("/");

  await expect(page.getByText("No balances yet")).toBeVisible();
  await expect(
    page.getByText("No transaction history has been recorded for this account yet.").first()
  ).toBeVisible();
});

test("shows stale operational data notices", async ({ page }) => {
  await mockWebApi(page, buildWebScenario("stale"));

  await page.goto("/");

  await expect(
    page.getByText("The latest operational snapshot is older than expected.")
  ).toBeVisible();
});

test("preserves the shell and renders inline API failures", async ({ page }) => {
  await mockWebApi(page, {
    balances: {
      ok: false,
      message: "Failed to load customer balances."
    },
    history: {
      ok: false,
      message: "Failed to load transaction history."
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("main").getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
  await expect(page.getByText("Failed to load customer balances.")).toBeVisible();
  await expect(page.getByText("Failed to load transaction history.")).toBeVisible();
});

test("keeps RTL direction and wallet references safe", async ({ page }) => {
  await seedWebLocale(page, "ar");
  await mockWebApi(page);

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.locator("bdi").filter({ hasText: "0x1111222233334444555566667777888899990000" })
  ).toBeVisible();
});
