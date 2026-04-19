import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MfaRecoveryPage } from "./MfaRecoveryPage";
import {
  OperatorSessionProvider,
  operatorSessionStorageKey
} from "@/state/operator-session";
import {
  approveCustomerMfaRecoveryRequest,
  listCustomerMfaRecoveryRequests,
  requestCustomerMfaRecovery
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  approveCustomerMfaRecoveryRequest: vi.fn(),
  executeCustomerMfaRecoveryRequest: vi.fn(),
  listCustomerMfaRecoveryRequests: vi.fn(),
  rejectCustomerMfaRecoveryRequest: vi.fn(),
  requestCustomerMfaRecovery: vi.fn()
}));

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "mfa_recovery_1",
    requestType: "release_lockout",
    status: "pending_approval",
    requestNote: "Customer passed support identity review.",
    requestedByOperatorId: "ops_requester",
    requestedByOperatorRole: "operations_admin",
    requestedAt: "2026-04-19T10:00:00.000Z",
    approvedByOperatorId: null,
    approvedByOperatorRole: null,
    approvalNote: null,
    approvedAt: null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    rejectionNote: null,
    rejectedAt: null,
    executedByOperatorId: null,
    executedByOperatorRole: null,
    executionNote: null,
    executedAt: null,
    customer: {
      customerId: "customer_1",
      customerAccountId: "account_1",
      accountStatus: "active",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      firstName: "Amina",
      lastName: "Raza"
    },
    ...overrides
  };
}

function renderPage(initialEntry = "/mfa-recovery?request=mfa_recovery_1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OperatorSessionProvider
        serverUrl="http://localhost:9001"
        initialDraft={{
          baseUrl: "http://localhost:9001",
          accessToken: "test-access-token",
          operatorId: "ops_1",
          operatorRole: "operations_admin"
        }}
      >
        <MemoryRouter
          initialEntries={[initialEntry]}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <MfaRecoveryPage />
        </MemoryRouter>
      </OperatorSessionProvider>
    </QueryClientProvider>
  );
}

describe("MfaRecoveryPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      operatorSessionStorageKey,
      JSON.stringify({
        baseUrl: "http://localhost:9001"
      })
    );

    vi.mocked(listCustomerMfaRecoveryRequests).mockResolvedValue({
      requests: [createRequest()],
      limit: 25,
      totalCount: 1,
      summary: {
        byStatus: [
          {
            status: "pending_approval",
            count: 1
          }
        ]
      }
    });

    vi.mocked(approveCustomerMfaRecoveryRequest).mockResolvedValue({
      request: createRequest({
        status: "approved",
        approvedByOperatorId: "ops_1",
        approvedByOperatorRole: "risk_manager",
        approvedAt: "2026-04-19T10:10:00.000Z",
        approvalNote: "Support evidence reviewed."
      }),
      stateReused: false
    });

    vi.mocked(requestCustomerMfaRecovery).mockResolvedValue({
      request: createRequest({
        id: "mfa_recovery_2",
        customer: {
          customerId: "customer_2",
          customerAccountId: "account_2",
          accountStatus: "active",
          supabaseUserId: "supabase_2",
          email: "reset@example.com",
          firstName: "Bilal",
          lastName: "Khan"
        },
        requestType: "reset_mfa"
      }),
      stateReused: false
    });
  });

  it("renders the recovery queue and selected customer details", async () => {
    renderPage();

    expect(await screen.findByText("Customer MFA Recovery")).toBeInTheDocument();
    expect(screen.getAllByText("user@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Customer impact")).toBeInTheDocument();
    expect(screen.getAllByText("Amina Raza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0);
  });

  it("approves a pending recovery request with an operator note", async () => {
    renderPage();

    await screen.findByText("Customer MFA Recovery");

    fireEvent.change(screen.getByLabelText("Recovery action note"), {
      target: { value: "Second operator reviewed support proof." }
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approve request" }));

    await waitFor(() => {
      expect(approveCustomerMfaRecoveryRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        "mfa_recovery_1",
        {
          note: "Second operator reviewed support proof."
        }
      );
    });

    expect(await screen.findByText(/Recovery request approved/i)).toBeInTheDocument();
  });

  it("opens a new governed MFA reset request from the rail", async () => {
    renderPage("/mfa-recovery");

    await screen.findByText("Customer MFA Recovery");

    fireEvent.change(screen.getByLabelText("Customer Supabase user ID"), {
      target: { value: "supabase_2" }
    });
    fireEvent.change(screen.getByLabelText("Recovery type"), {
      target: { value: "reset_mfa" }
    });
    fireEvent.change(screen.getByLabelText("Recovery request note"), {
      target: { value: "Customer lost device and backup factor is unavailable." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Open recovery request" }));

    await waitFor(() => {
      expect(requestCustomerMfaRecovery).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        "supabase_2",
        {
          requestType: "reset_mfa",
          note: "Customer lost device and backup factor is unavailable."
        }
      );
    });

    expect(await screen.findByText(/Recovery request created/i)).toBeInTheDocument();
  });
});
