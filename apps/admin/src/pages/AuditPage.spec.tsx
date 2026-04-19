import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuditPage } from "./AuditPage";
import {
  OperatorSessionProvider,
  operatorSessionStorageKey
} from "@/state/operator-session";
import { listAuditEvents } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listAuditEvents: vi.fn(),
  getReleaseReadinessApprovalRecoveryTarget: vi.fn()
}));

function renderPage(initialEntry = "/audit") {
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
          <AuditPage />
        </MemoryRouter>
      </OperatorSessionProvider>
    </QueryClientProvider>
  );
}

describe("AuditPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      operatorSessionStorageKey,
      JSON.stringify({
        baseUrl: "http://localhost:9001"
      })
    );

    vi.mocked(listAuditEvents).mockResolvedValue({
      events: [
        {
          id: "audit_1",
          actorType: "operator",
          actorId: "ops_1",
          action: "release_readiness.approval_mutation_blocked",
          targetType: "ReleaseReadinessApproval",
          targetId: "approval_1",
          metadata: {
            attemptedAction: "approve",
            reason: "selected_approval_not_actionable",
            selectedApprovalId: "approval_1",
            actionableApprovalId: "approval_2",
            headApprovalId: "approval_2",
            tailApprovalId: "approval_1",
            integrityStatus: "critical",
            integrityIssues: [
              {
                code: "multiple_pending_approvals",
                approvalId: "approval_1",
                relatedApprovalId: null,
                description:
                  "Approval approval_1 is pending while another approval in the same lineage is also pending."
              }
            ]
          },
          createdAt: "2026-04-17T10:00:00.000Z",
          customer: null
        }
      ],
      limit: 30,
      totalCount: 1,
      filters: {
        search: null,
        customerId: null,
        email: null,
        actorType: null,
        actorId: null,
        action: null,
        targetType: null,
        targetId: null,
        dateFrom: null,
        dateTo: null
      }
    });
  });

  it("renders blocked launch approval mutation details from audit metadata", async () => {
    renderPage("/audit?event=audit_1");

    expect(await screen.findByText("Blocked approval mutation")).toBeInTheDocument();
    expect(screen.getByText("Attempted action")).toBeInTheDocument();
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Actionable approval")).toBeInTheDocument();
    expect(screen.getAllByText("approval_2").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Launch approval mutation was blocked")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open actionable approval" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /operators should continue with approval_2 after refreshing lineage state/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /approval approval_1 is pending while another approval in the same lineage is also pending/i
      ).length
    ).toBeGreaterThan(0);
  });
});
