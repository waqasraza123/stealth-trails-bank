import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReconciliationPage } from "./ReconciliationPage";
import {
  OperatorSessionProvider,
  operatorSessionStorageKey
} from "@/state/operator-session";
import {
  getLedgerReconciliationWorkspace,
  listLedgerReconciliationMismatches,
  listLedgerReconciliationRuns,
  replayConfirmMismatch,
  requestLedgerReconciliationReplayApproval
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  dismissLedgerReconciliationMismatch: vi.fn(),
  getLedgerReconciliationWorkspace: vi.fn(),
  listLedgerReconciliationMismatches: vi.fn(),
  listLedgerReconciliationRuns: vi.fn(),
  openLedgerReconciliationReviewCase: vi.fn(),
  repairLedgerCustomerBalance: vi.fn(),
  replayConfirmMismatch: vi.fn(),
  replaySettleMismatch: vi.fn(),
  requestLedgerReconciliationReplayApproval: vi.fn()
}));

function renderPage(initialEntry = "/reconciliation") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OperatorSessionProvider serverUrl="http://localhost:9001">
        <MemoryRouter
          initialEntries={[initialEntry]}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <ReconciliationPage />
        </MemoryRouter>
      </OperatorSessionProvider>
    </QueryClientProvider>
  );
}

function createWorkspace(
  replayApprovalRequests: Array<Record<string, unknown>> = []
) {
  return {
    mismatch: {
      id: "mismatch_1",
      mismatchKey: "transaction_intent:intent_1",
      scope: "transaction_intent",
      status: "open",
      severity: "critical",
      recommendedAction: "replay_confirm",
      reasonCode: "deposit_confirm_missing",
      summary: "Deposit confirm replay is required.",
      chainId: 8453,
      customer: {
        customerId: "customer_1",
        email: "user@example.com",
        supabaseUserId: "supabase_1",
        firstName: "Amina",
        lastName: "Raza"
      },
      customerAccount: {
        customerAccountId: "account_1",
        status: "active"
      },
      asset: {
        assetId: "asset_1",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453
      },
      transactionIntent: {
        transactionIntentId: "intent_1",
        intentType: "deposit",
        status: "broadcast",
        policyDecision: "approved",
        requestedAmount: "5.00",
        settledAmount: null,
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:05:00.000Z"
      },
      linkedReviewCase: null,
      latestSnapshot: {
        state: "ready_for_confirm_replay"
      },
      resolutionMetadata: null,
      resolutionNote: null,
      detectionCount: 1,
      firstDetectedAt: "2026-04-06T00:00:00.000Z",
      lastDetectedAt: "2026-04-06T00:05:00.000Z",
      resolvedAt: null,
      resolvedByOperatorId: null,
      dismissedAt: null,
      dismissedByOperatorId: null,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:05:00.000Z"
    },
    currentSnapshot: {
      state: "ready_for_confirm_replay"
    },
    replayApprovalRequests,
    recentAuditEvents: []
  };
}

describe("ReconciliationPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      operatorSessionStorageKey,
      JSON.stringify({
        baseUrl: "http://localhost:9001",
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        apiKey: "test-key"
      })
    );

    vi.mocked(listLedgerReconciliationMismatches).mockResolvedValue({
      mismatches: [createWorkspace().mismatch],
      limit: 20,
      totalCount: 1,
      summary: {
        byStatus: [],
        byScope: [],
        bySeverity: [],
        byRecommendedAction: []
      }
    });
    vi.mocked(listLedgerReconciliationRuns).mockResolvedValue({
      runs: [],
      limit: 10,
      totalCount: 0
    });
    vi.mocked(replayConfirmMismatch).mockResolvedValue({
      mismatch: createWorkspace().mismatch
    });
    vi.mocked(requestLedgerReconciliationReplayApproval).mockResolvedValue({
      mismatch: createWorkspace().mismatch,
      request: {
        id: "approval_new",
        transactionIntentId: "intent_1",
        chainId: 8453,
        intentType: "deposit",
        replayAction: "settle",
        status: "pending_approval",
        requestedByOperatorId: "ops_1",
        requestedByOperatorRole: "operations_admin",
        requestNote: null,
        requestedAt: "2026-04-06T00:10:00.000Z",
        approvedByOperatorId: null,
        approvedByOperatorRole: null,
        approvalNote: null,
        approvedAt: null,
        executedByOperatorId: null,
        executedByOperatorRole: null,
        executedAt: null
      },
      stateReused: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses the surfaced approval request id when replaying confirm", async () => {
    vi.mocked(getLedgerReconciliationWorkspace).mockResolvedValue(
      createWorkspace([
        {
          id: "approval_confirm_1",
          transactionIntentId: "intent_1",
          chainId: 8453,
          intentType: "deposit",
          replayAction: "confirm",
          status: "approved",
          requestedByOperatorId: "ops_requester",
          requestedByOperatorRole: "operations_admin",
          requestNote: "Need confirm replay.",
          requestedAt: "2026-04-06T00:06:00.000Z",
          approvedByOperatorId: "ops_approver",
          approvedByOperatorRole: "operations_admin",
          approvalNote: "Approved.",
          approvedAt: "2026-04-06T00:07:00.000Z",
          executedByOperatorId: null,
          executedByOperatorRole: null,
          executedAt: null
        }
      ])
    );

    renderPage();

    expect(await screen.findByText("Governed replay approvals")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /i reviewed the mismatch snapshot/i
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Replay confirm" }));

    await waitFor(() => {
      expect(replayConfirmMismatch).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        "mismatch_1",
        "approval_confirm_1",
        undefined
      );
    });
  });

  it("requests governed settle approval from the reconciliation workspace", async () => {
    vi.mocked(getLedgerReconciliationWorkspace).mockResolvedValue(
      createWorkspace()
    );

    renderPage();

    expect(await screen.findByText("Governed replay approvals")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /i reviewed the mismatch snapshot/i
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Request settle approval" })
    );

    await waitFor(() => {
      expect(requestLedgerReconciliationReplayApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        "mismatch_1",
        "settle",
        undefined
      );
    });
  });
});
