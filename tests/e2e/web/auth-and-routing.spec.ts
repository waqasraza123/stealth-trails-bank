import { expect, test } from "@playwright/test";
import { mockWebApi, seedCustomerSession, seedWebLocale } from "../support/web";

test("redirects unauthenticated users to sign-in and completes sign-in successfully", async ({
  page
}) => {
  await mockWebApi(page);

  await page.goto("/wallet");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);

  await page.getByLabel("Email").fill("amina@example.com");
  await page.getByLabel("Password").fill("P@ssw0rd");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
});

test("surfaces sign-in API failures", async ({ page }) => {
  await mockWebApi(page, {
    login: {
      ok: false,
      statusCode: 401,
      message: "Invalid credentials."
    }
  });

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill("amina@example.com");
  await page.getByLabel("Password").fill("bad-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toContainText("Invalid credentials.");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test("persists Arabic locale on auth surfaces after reload", async ({ page }) => {
  await mockWebApi(page);

  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: "العربية" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("redirects authenticated users away from auth routes and preserves locale after reload", async ({
  page
}) => {
  await seedCustomerSession(page);
  await seedWebLocale(page, "ar");
  await mockWebApi(page);

  await page.goto("/auth/sign-in");

  await expect(page).toHaveURL("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("keeps compatibility redirects and unknown-route fallback safe", async ({
  page
}) => {
  await seedCustomerSession(page);
  await mockWebApi(page);

  await page.goto("/staking");
  await expect(page).toHaveURL("/yield");
  await expect(
    page.getByRole("heading", { name: "Yield and infrastructure" })
  ).toBeVisible();

  await page.goto("/create-pool");
  await expect(page).toHaveURL("/yield");

  await page.goto("/definitely-missing");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
});
