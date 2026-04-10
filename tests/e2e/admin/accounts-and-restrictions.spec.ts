import { expect, test } from "@playwright/test";
import { expectJsonRequest, waitForJsonRequest } from "../support/common";
import { buildAdminScenario, mockAdminApi, seedOperatorSession } from "../support/admin";

test.beforeEach(async ({ page }) => {
  await seedOperatorSession(page);
});

test("loads the incident workspace and can start the incident", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/accounts");

  await expect(page).toHaveURL(/incident=incident_1/);
  await expect(page.getByText("Incident workspace")).toBeVisible();
  await expect(page.getByText("incident_1")).toBeVisible();

  const requestPromise = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/start"
  );
  await page.getByRole("button", { name: "Start incident" }).click();
  await expectJsonRequest(requestPromise, {});
  await expect(page.getByText("Oversight incident started.")).toBeVisible();
});

test("records notes and applies a governed account hold", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/accounts");
  await page.getByLabel("Oversight note").fill("Restriction evidence verified.");

  const noteRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/notes"
  );
  await page.getByRole("button", { name: "Record note" }).click();
  await expectJsonRequest(noteRequest, {
    note: "Restriction evidence verified."
  });
  await expect(page.getByText("Oversight note recorded.")).toBeVisible();

  await page
    .getByText("I reviewed the incident timeline, related cases, and current restriction state.")
    .click();
  await page.getByLabel("Restriction reason").selectOption("manual_review_hold");

  const holdRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/place-account-hold"
  );
  await page.getByRole("button", { name: "Apply account hold" }).click();
  await expectJsonRequest(holdRequest, {
    restrictionReasonCode: "manual_review_hold"
  });
  await expect(page.getByText("Account hold applied.")).toBeVisible();
});

test("resolves and dismisses incidents through governed controls", async ({ page }) => {
  await mockAdminApi(page);

  await page.goto("/accounts");
  await page
    .getByText("I reviewed the incident timeline, related cases, and current restriction state.")
    .click();

  const resolveRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/resolve"
  );
  await page.getByRole("button", { name: "Resolve incident" }).click();
  await expectJsonRequest(resolveRequest, {});
  await expect(page.getByText("Oversight incident resolved.")).toBeVisible();

  await page.getByRole("checkbox").check();
  const dismissRequest = waitForJsonRequest(
    page,
    "/oversight-incidents/internal/incident_1/dismiss"
  );
  await page.getByRole("button", { name: "Dismiss incident" }).click();
  await expectJsonRequest(dismissRequest, {});
  await expect(page.getByText("Oversight incident dismissed.")).toBeVisible();
});

test("shows inline action errors while preserving incident context", async ({ page }) => {
  await mockAdminApi(page, {
    applyAccountRestriction: {
      ok: false,
      statusCode: 500,
      message: "Failed to apply account restriction."
    }
  });

  await page.goto("/accounts");
  await page
    .getByText("I reviewed the incident timeline, related cases, and current restriction state.")
    .click();
  await page.getByRole("button", { name: "Apply account hold" }).click();

  await expect(page.getByText("Action failed")).toBeVisible();
  await expect(page.getByText("Failed to apply account restriction.")).toBeVisible();
  await expect(page.getByText("incident_1")).toBeVisible();
});

test("renders the empty active-hold state", async ({ page }) => {
  await mockAdminApi(page, buildAdminScenario("empty"));

  await page.goto("/accounts");

  await expect(page.getByText("No active account holds")).toBeVisible();
});
