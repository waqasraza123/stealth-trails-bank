import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "../components/console/SessionCard";
import { AdminI18nProvider } from "../i18n/provider";
import { adminLocaleStorageKey } from "../i18n/provider";
import App from "../App";
import {
  OperatorSessionProvider,
  operatorSessionSettingsStorageKey,
  operatorSessionTokenStorageKey
} from "../state/operator-session";

vi.mock("../lib/api", () => ({
  getOperatorSession: vi.fn(async () => ({
    operatorId: "ops_1",
    operatorRole: "operations_admin",
    operatorRoles: ["operations_admin"],
    operatorDbId: "operator_db_1",
    operatorSupabaseUserId: "supabase_ops_1",
    operatorEmail: "ops@example.com",
    authSource: "supabase_jwt",
    environment: "development",
    sessionCorrelationId: "session_1"
  })),
  getOperationsStatus: vi.fn(async () => ({
    workerHealth: { status: "healthy" },
    queueHealth: {
      status: "healthy",
      totalQueuedCount: 0,
      agedQueuedCount: 0,
      oldestQueuedIntentCreatedAt: null
    },
    chainHealth: {
      status: "healthy",
      oldestLaggingBroadcastCreatedAt: null
    },
    treasuryHealth: { status: "healthy" },
    reconciliationHealth: {
      status: "healthy",
      openMismatchCount: 0,
      criticalMismatchCount: 0
    },
    incidentSafety: {
      status: "healthy",
      openOversightIncidentCount: 0,
      activeRestrictedAccountCount: 0,
      openReviewCaseCount: 0
    },
    withdrawalExecutionHealth: {
      queuedManagedWithdrawalCount: 0,
      signedWithdrawalCount: 0,
      broadcastingWithdrawalCount: 0,
      pendingConfirmationWithdrawalCount: 0,
      failedManagedWithdrawalCount: 0,
      retryableWithdrawalFailureCount: 0,
      manualInterventionWithdrawalCount: 0,
      unresolvedReserveMismatchCount: 0
    },
    alertSummary: {
      openCount: 0,
      criticalCount: 0
    },
    recentAlerts: []
  })),
  getReleaseReadinessSummary: vi.fn(async () => ({
    overallStatus: "healthy",
    summary: {
      passedCheckCount: 0,
      failedCheckCount: 0,
      pendingCheckCount: 0
    }
  })),
  listCustomerSessionRisks: vi.fn(),
  revokeCustomerSessionRisk: vi.fn()
}));

vi.mock("@stealth-trails-bank/config/web", () => ({
  loadWebRuntimeConfig: () => ({
    serverUrl: "http://localhost:9001"
  })
}));

describe("Admin console", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  });

  it("renders the operator console shell and credential form", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Operator Console" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Operations Overview" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Queues")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Treasury")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Session Risk")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Credentials required/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Operator Access Token")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Session" })
    ).toBeInTheDocument();
  });

  it("persists only the base URL and requires re-entering the access token after reload", async () => {
    const user = userEvent.setup();

    const renderSessionCard = () =>
      render(
        <AdminI18nProvider>
          <OperatorSessionProvider serverUrl="http://localhost:9001">
            <SessionCard />
          </OperatorSessionProvider>
        </AdminI18nProvider>
      );

    renderSessionCard();

    await user.type(screen.getByLabelText("Operator Access Token"), "session-token");
    await user.click(screen.getByRole("button", { name: "Save Session" }));

    await waitFor(() => {
      expect(
        window.localStorage.getItem(operatorSessionSettingsStorageKey)
      ).toContain("\"baseUrl\":\"http://localhost:9001\"");
      expect(window.sessionStorage.getItem(operatorSessionTokenStorageKey)).toBeNull();
    });

    cleanup();
    renderSessionCard();

    expect(screen.getByLabelText("Operator Access Token")).toHaveValue("");
  });

  it("switches the shell into Arabic and persists document rtl state", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "العربية" }));

    expect(
      await screen.findByRole("heading", { name: "وحدة تحكم المشغل" })
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(window.localStorage.getItem(adminLocaleStorageKey)).toBe("ar");
  });
});
