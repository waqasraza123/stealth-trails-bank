import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { mockWebApi, seedCustomerSession } from "../support/web";

test.beforeEach(async ({ page }) => {
  await seedCustomerSession(page);
});

test("rotates the password successfully for a customer-backed profile", async ({
  page
}) => {
  await mockWebApi(page);

  await page.goto("/profile");
  await page.getByLabel("Current password").fill("current-pass");
  await page.getByLabel(/^New password$/).fill("new-strong-pass");
  await page.getByLabel(/^Confirm new password$/).fill("new-strong-pass");

  const requestPromise = waitForJsonRequest(page, "/auth/password", "PATCH");
  await page.getByRole("button", { name: "Update password" }).click();

  await expectJsonRequest(requestPromise, {
    currentPassword: "current-pass",
    newPassword: "new-strong-pass"
  });
  await expect(page.getByText("Password updated successfully.")).toBeVisible();
});

test("surfaces password rotation API failures", async ({ page }) => {
  await mockWebApi(page, {
    updatePassword: {
      ok: false,
      statusCode: 401,
      message: "Current password is incorrect."
    }
  });

  await page.goto("/profile");
  await page.getByLabel("Current password").fill("wrong-pass");
  await page.getByLabel(/^New password$/).fill("new-strong-pass");
  await page.getByLabel(/^Confirm new password$/).fill("new-strong-pass");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByText("Current password is incorrect.")).toBeVisible();
});

test("saves notification preferences successfully", async ({ page }) => {
  await mockWebApi(page, {
    updateNotificationPreferences: {
      data: {
        notificationPreferences: {
          depositEmails: true,
          withdrawalEmails: true,
          loanEmails: true,
          productUpdateEmails: true
        }
      }
    }
  });

  await page.goto("/profile");
  await page.getByRole("switch", { name: "Product updates" }).click();

  const requestPromise = waitForJsonRequest(
    page,
    "/notification-preferences",
    "PATCH"
  );
  await page.getByRole("button", { name: "Save preferences" }).click();

  await expectJsonRequest(requestPromise, {
    depositEmails: true,
    withdrawalEmails: true,
    loanEmails: true,
    productUpdateEmails: true
  });
  await expect(page.getByText("Notification preferences saved.")).toBeVisible();
});

test("preserves the notification preference draft when saving fails", async ({
  page
}) => {
  await mockWebApi(page, {
    updateNotificationPreferences: {
      ok: false,
      statusCode: 500,
      message: "Notification preference update failed."
    }
  });

  await page.goto("/profile");
  const productUpdatesSwitch = page.getByRole("switch", {
    name: "Product updates"
  });
  await productUpdatesSwitch.click();
  await page.getByRole("button", { name: "Save preferences" }).click();

  await expect(page.getByText("Notification preference update failed.")).toBeVisible();
  await expect(productUpdatesSwitch).toHaveAttribute("data-state", "checked");
});

test("renders a read-only settings state for legacy-only profiles", async ({
  page
}) => {
  await mockWebApi(page, {
    profile: {
      data: {
        id: 1,
        customerId: null,
        supabaseUserId: "supabase_1",
        email: "amina@example.com",
        firstName: "Amina",
        lastName: "Rahman",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
        accountStatus: null,
        activatedAt: null,
        restrictedAt: null,
        frozenAt: null,
        closedAt: null,
        passwordRotationAvailable: false,
        notificationPreferences: null
      }
    }
  });

  await page.goto("/profile");

  await expect(page.getByText("Password rotation unavailable")).toBeVisible();
  await expect(
    page.getByText("Notification preferences unavailable")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update password" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save preferences" })
  ).toHaveCount(0);
});
