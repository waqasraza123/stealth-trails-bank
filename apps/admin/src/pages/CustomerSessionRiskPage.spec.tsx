import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CustomerSessionRiskPage } from "./CustomerSessionRiskPage";
import {
  OperatorSessionProvider,
  operatorSessionStorageKey,
} from "@/state/operator-session";
import {
  listCustomerSessionRisks,
  revokeCustomerSessionRisk,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listCustomerSessionRisks: vi.fn(),
  revokeCustomerSessionRisk: vi.fn(),
}));

function createRiskSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session_risk_1",
    clientPlatform: "web",
    trusted: false,
    challengeState: "expired",
    trustChallengeSentAt: "2026-04-20T09:00:00.000Z",
    trustChallengeExpiresAt: "2026-04-20T09:10:00.000Z",
    userAgent: "Mozilla/5.0",
    ipAddress: "203.0.113.10",
    createdAt: "2026-04-20T08:55:00.000Z",
    lastSeenAt: "2026-04-20T09:12:00.000Z",
    revokedAt: null,
    customer: {
      customerId: "customer_1",
      customerAccountId: "account_1",
      accountStatus: "active",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      firstName: "Amina",
      lastName: "Raza",
    },
    ...overrides,
  };
}

function renderPage(initialEntry = "/session-risk?session=session_risk_1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OperatorSessionProvider
        serverUrl="http://localhost:9001"
        initialDraft={{
          baseUrl: "http://localhost:9001",
          accessToken: "test-access-token",
          operatorId: "ops_1",
          operatorRole: "operations_admin",
        }}
      >
        <MemoryRouter
          initialEntries={[initialEntry]}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <CustomerSessionRiskPage />
        </MemoryRouter>
      </OperatorSessionProvider>
    </QueryClientProvider>,
  );
}

describe("CustomerSessionRiskPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      operatorSessionStorageKey,
      JSON.stringify({
        baseUrl: "http://localhost:9001",
      }),
    );

    vi.mocked(listCustomerSessionRisks).mockResolvedValue({
      sessions: [createRiskSession()],
      limit: 30,
      totalCount: 1,
      summary: {
        byChallengeState: [
          {
            challengeState: "pending",
            count: 0,
          },
          {
            challengeState: "expired",
            count: 1,
          },
          {
            challengeState: "not_started",
            count: 0,
          },
        ],
        byPlatform: [
          {
            clientPlatform: "web",
            count: 1,
          },
          {
            clientPlatform: "mobile",
            count: 0,
          },
          {
            clientPlatform: "unknown",
            count: 0,
          },
        ],
      },
    });

    vi.mocked(revokeCustomerSessionRisk).mockResolvedValue({
      session: createRiskSession({
        revokedAt: "2026-04-20T09:14:00.000Z",
      }),
      stateReused: false,
    });
  });

  it("renders the session risk queue and selected customer session context", async () => {
    renderPage();

    expect(await screen.findByText("Customer Session Risk")).toBeInTheDocument();
    expect(screen.getAllByText("user@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Session detail")).toBeInTheDocument();
    expect(screen.getAllByText("Amina Raza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Challenge Expired").length).toBeGreaterThan(0);
  });

  it("revokes the selected risky session with an operator note", async () => {
    renderPage();

    await screen.findByText("Customer Session Risk");

    fireEvent.change(screen.getByLabelText("Revocation note"), {
      target: { value: "Customer reported unfamiliar browser activity." },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Revoke risky session" }));

    await waitFor(() => {
      expect(revokeCustomerSessionRisk).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1",
        }),
        "session_risk_1",
        {
          note: "Customer reported unfamiliar browser activity.",
        },
      );
    });

    expect(await screen.findByText(/Risky session revoked/i)).toBeInTheDocument();
  });
});
