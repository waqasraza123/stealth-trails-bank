import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LaunchReadinessPage } from "./LaunchReadinessPage";
import {
  OperatorSessionProvider,
  operatorSessionStorageKey
} from "@/state/operator-session";
import {
  getLaunchClosureStatus,
  getReleaseReadinessSummary,
  listPendingReleases,
  listReleaseReadinessApprovals,
  listReleaseReadinessEvidence,
  listReleasedReleases
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getReleaseReadinessSummary: vi.fn(),
  listReleaseReadinessEvidence: vi.fn(),
  listReleaseReadinessApprovals: vi.fn(),
  listPendingReleases: vi.fn(),
  listReleasedReleases: vi.fn(),
  getLaunchClosureStatus: vi.fn(),
  createReleaseReadinessEvidence: vi.fn(),
  requestReleaseReadinessApproval: vi.fn(),
  approveReleaseReadinessApproval: vi.fn(),
  rejectReleaseReadinessApproval: vi.fn(),
  validateLaunchClosureManifest: vi.fn(),
  scaffoldLaunchClosurePack: vi.fn()
}));

function buildSummary(releaseIdentifier: string | null) {
  return {
    generatedAt: "2026-04-14T10:00:00.000Z",
    releaseIdentifier,
    environment: null,
    overallStatus: "warning" as const,
    summary: {
      requiredCheckCount: 10,
      passedCheckCount: releaseIdentifier ? 1 : 2,
      failedCheckCount: 0,
      pendingCheckCount: releaseIdentifier ? 9 : 8
    },
    requiredChecks: [
      {
        evidenceType: "platform_alert_delivery_slo",
        label: "Delivery Target SLO Alerting",
        description: "Release-scoped alert proof.",
        runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
        acceptedEnvironments: ["staging", "production_like", "production"],
        status: releaseIdentifier ? "passed" : "pending",
        latestEvidence: null
      }
    ],
    recentEvidence: releaseIdentifier
      ? [
          {
            id: `${releaseIdentifier}-evidence`,
            evidenceType: "platform_alert_delivery_slo",
            environment: "production_like",
            status: "passed" as const,
            releaseIdentifier,
            rollbackReleaseIdentifier: null,
            backupReference: null,
            summary: `Evidence for ${releaseIdentifier}`,
            note: null,
            operatorId: "ops_1",
            operatorRole: "operations_admin",
            runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
            evidenceLinks: [],
            evidencePayload: null,
            startedAt: null,
            completedAt: null,
            observedAt: "2026-04-14T09:00:00.000Z",
            createdAt: "2026-04-14T09:00:00.000Z",
            updatedAt: "2026-04-14T09:00:00.000Z"
          }
        ]
      : []
  };
}

function buildEvidenceList(releaseIdentifier: string | undefined) {
  const effectiveRelease = releaseIdentifier ?? "launch-2026.04.13.1";

  return {
    evidence: [
      {
        id: `${effectiveRelease}-evidence`,
        evidenceType: "platform_alert_delivery_slo",
        environment: "production_like",
        status: "passed" as const,
        releaseIdentifier: effectiveRelease,
        rollbackReleaseIdentifier: null,
        backupReference: null,
        summary: `Evidence for ${effectiveRelease}`,
        note: null,
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
        evidenceLinks: [],
        evidencePayload: null,
        startedAt: null,
        completedAt: null,
        observedAt: "2026-04-14T09:00:00.000Z",
        createdAt: "2026-04-14T09:00:00.000Z",
        updatedAt: "2026-04-14T09:00:00.000Z"
      }
    ],
    limit: 20,
    totalCount: 1
  };
}

function buildApproval(releaseIdentifier: string) {
  return {
    id: `${releaseIdentifier}-approval`,
    releaseIdentifier,
    environment: "production_like",
    rollbackReleaseIdentifier: "launch-rollback-2026.04.12.4",
    status: "pending_approval" as const,
    summary: `Approval summary for ${releaseIdentifier}`,
    requestNote: null,
    approvalNote: null,
    rejectionNote: null,
    requestedByOperatorId: "ops_1",
    requestedByOperatorRole: "operations_admin",
    approvedByOperatorId: null,
    approvedByOperatorRole: null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    checklist: {
      securityConfigurationComplete: true,
      accessAndGovernanceComplete: true,
      dataAndRecoveryComplete: true,
      platformHealthComplete: true,
      functionalProofComplete: true,
      contractAndChainProofComplete: true,
      finalSignoffComplete: true,
      unresolvedRisksAccepted: true,
      openBlockers: [],
      residualRiskNote: null
    },
    evidenceSnapshot: {
      generatedAt: "2026-04-14T10:00:00.000Z",
      overallStatus: "warning" as const,
      summary: {
        requiredCheckCount: 10,
        passedCheckCount: 1,
        failedCheckCount: 0,
        pendingCheckCount: 9
      },
      requiredChecks: [
        {
          evidenceType: "platform_alert_delivery_slo",
          status: "passed" as const,
          latestEvidenceObservedAt: "2026-04-14T09:00:00.000Z",
          latestEvidenceEnvironment: "production_like",
          latestEvidenceStatus: "passed" as const
        }
      ]
    },
    gate: {
      overallStatus: "blocked" as const,
      approvalEligible: false,
      missingChecklistItems: [],
      missingEvidenceTypes: ["critical_alert_reescalation"],
      failedEvidenceTypes: [],
      staleEvidenceTypes: [],
      maximumEvidenceAgeHours: 72,
      openBlockers: [],
      generatedAt: "2026-04-14T10:00:00.000Z"
    },
    requestedAt: "2026-04-14T10:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z"
  };
}

function renderPage() {
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
          initialEntries={["/launch-readiness"]}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <LaunchReadinessPage />
        </MemoryRouter>
      </OperatorSessionProvider>
    </QueryClientProvider>
  );
}

describe("LaunchReadinessPage", () => {
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

    vi.mocked(listReleaseReadinessApprovals).mockResolvedValue({
      approvals: [
        buildApproval("launch-2026.04.13.1"),
        buildApproval("launch-2026.04.13.2")
      ],
      limit: 20,
      totalCount: 2
    });
    vi.mocked(listPendingReleases).mockResolvedValue({
      releases: [],
      limit: 20,
      totalCount: 0
    });
    vi.mocked(listReleasedReleases).mockResolvedValue({
      releases: [],
      limit: 20,
      totalCount: 0
    });
    vi.mocked(getLaunchClosureStatus).mockResolvedValue({
      summaryMarkdown: "Launch-closure status."
    });
    vi.mocked(getReleaseReadinessSummary).mockImplementation(
      async (_session, params = {}) =>
        buildSummary(
          typeof params.releaseIdentifier === "string"
            ? params.releaseIdentifier
            : null
        )
    );
    vi.mocked(listReleaseReadinessEvidence).mockImplementation(
      async (_session, params) =>
        buildEvidenceList(
          typeof params.releaseIdentifier === "string"
            ? params.releaseIdentifier
            : undefined
        )
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults the workspace to the first selected approval release", async () => {
    renderPage();

    await waitFor(() => {
      expect(vi.mocked(getReleaseReadinessSummary)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          releaseIdentifier: "launch-2026.04.13.1"
        }
      );
    });

    await waitFor(() => {
      expect(vi.mocked(listReleaseReadinessEvidence)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          limit: 20,
          releaseIdentifier: "launch-2026.04.13.1"
        }
      );
    });

    expect(screen.getByLabelText("Release scope")).toHaveValue(
      "launch-2026.04.13.1"
    );
  });

  it("re-queries the release workspace when the operator changes scope", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Release scope")).toHaveValue(
        "launch-2026.04.13.1"
      );
    });

    fireEvent.change(screen.getByLabelText("Release scope"), {
      target: {
        value: "launch-2026.04.13.2"
      }
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Release scope")).toHaveValue(
        "launch-2026.04.13.2"
      );
    });

    await waitFor(() => {
      expect(vi.mocked(getReleaseReadinessSummary)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          releaseIdentifier: "launch-2026.04.13.2"
        }
      );
    });

    await waitFor(() => {
      expect(vi.mocked(listReleaseReadinessEvidence)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          limit: 20,
          releaseIdentifier: "launch-2026.04.13.2"
        }
      );
    });
  });
});
