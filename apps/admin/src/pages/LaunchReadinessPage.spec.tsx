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
  listLaunchClosurePacks,
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
  listLaunchClosurePacks: vi.fn(),
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
    launchClosurePack: {
      id: `${releaseIdentifier}-pack`,
      version: 3,
      artifactChecksumSha256: `checksum-${releaseIdentifier}`
    },
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
          latestEvidenceStatus: "passed" as const,
          latestEvidenceReleaseIdentifier: releaseIdentifier,
          latestEvidenceRollbackReleaseIdentifier: null,
          latestEvidenceBackupReference: null
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
      metadataMismatches: [],
      maximumEvidenceAgeHours: 72,
      openBlockers: [],
      generatedAt: "2026-04-14T10:00:00.000Z"
    },
    launchClosureDrift: {
      changed: true,
      currentOverallStatus: "ready" as const,
      summaryDelta: {
        passedCheckCount: 2,
        failedCheckCount: 0,
        pendingCheckCount: -2
      },
      missingEvidenceTypesAdded: [],
      missingEvidenceTypesResolved: ["critical_alert_reescalation"],
      failedEvidenceTypesAdded: [],
      failedEvidenceTypesResolved: [],
      staleEvidenceTypesAdded: [],
      staleEvidenceTypesResolved: [],
      openBlockersAdded: [],
      openBlockersResolved: [],
      newerPackAvailable: true,
      latestPack: {
        id: `${releaseIdentifier}-pack-v4`,
        version: 4,
        artifactChecksumSha256: `checksum-${releaseIdentifier}-v4`
      }
    },
    requestedAt: "2026-04-14T10:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z"
  };
}

function buildLaunchClosureStatus(releaseIdentifier: string | null) {
  return {
    generatedAt: "2026-04-14T10:00:00.000Z",
    releaseIdentifier,
    environment: releaseIdentifier ? "production_like" : null,
    overallStatus: "blocked" as const,
    maximumEvidenceAgeHours: 72,
    externalChecks: [
      {
        evidenceType: "platform_alert_delivery_slo",
        label: "Delivery Target SLO Alerting",
        status: "passed" as const,
        acceptedEnvironments: ["staging", "production_like", "production"],
        latestEvidence: releaseIdentifier
          ? {
              id: `${releaseIdentifier}-platform-alert`,
              evidenceType: "platform_alert_delivery_slo",
              environment: "production_like",
              status: "passed" as const,
              releaseIdentifier,
              rollbackReleaseIdentifier: null,
              backupReference: null,
              summary: "Platform alert delivery proof recorded.",
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
          : null
      },
      {
        evidenceType: "critical_alert_reescalation",
        label: "Critical Alert Re-escalation Cadence",
        status: "pending" as const,
        acceptedEnvironments: ["staging", "production_like", "production"],
        latestEvidence: null
      }
    ],
    latestApproval: releaseIdentifier ? buildApproval(releaseIdentifier) : null,
    summaryMarkdown: "Launch-closure status."
  };
}

function renderPage(initialEntry = "/launch-readiness") {
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

    vi.mocked(listReleaseReadinessApprovals).mockImplementation(
      async (_session, params) => {
        const approvals = [
          buildApproval("launch-2026.04.13.1"),
          buildApproval("launch-2026.04.13.2")
        ];
        const releaseIdentifier =
          typeof params.releaseIdentifier === "string"
            ? params.releaseIdentifier
            : undefined;
        const scopedApprovals = releaseIdentifier
          ? approvals.filter(
              (approval) => approval.releaseIdentifier === releaseIdentifier
            )
          : approvals;

        return {
          approvals: scopedApprovals,
          limit: typeof params.limit === "number" ? params.limit : 20,
          totalCount: scopedApprovals.length
        };
      }
    );
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
      ...buildLaunchClosureStatus(null)
    });
    vi.mocked(listLaunchClosurePacks).mockImplementation(async (_session, params) => {
      const releaseIdentifier =
        typeof params.releaseIdentifier === "string"
          ? params.releaseIdentifier
          : "launch-2026.04.13.1";

      return {
        packs: [
          {
            id: `${releaseIdentifier}-pack`,
            releaseIdentifier,
            environment:
              typeof params.environment === "string"
                ? params.environment
                : "production_like",
            version: 3,
            generatedByOperatorId: "ops_1",
            generatedByOperatorRole: "operations_admin",
            artifactChecksumSha256: `checksum-${releaseIdentifier}`,
            artifactPayload: {},
            createdAt: "2026-04-14T10:00:00.000Z",
            updatedAt: "2026-04-14T10:00:00.000Z"
          }
        ],
        limit: typeof params.limit === "number" ? params.limit : 10,
        totalCount: 1
      };
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

    await waitFor(() => {
      expect(vi.mocked(listReleaseReadinessApprovals)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          limit: 20,
          releaseIdentifier: "launch-2026.04.13.1"
        }
      );
    });

    await waitFor(() => {
      expect(vi.mocked(getLaunchClosureStatus)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          releaseIdentifier: "launch-2026.04.13.1"
        }
      );
    });

    expect(screen.getByText("Operational posture")).toBeVisible();
    expect(screen.getByText("External operational checks")).toBeVisible();
    expect(
      screen.getByText(/No governed approval request exists for the selected release scope yet/i)
    ).toBeVisible();

    expect(screen.getByLabelText("Release scope")).toHaveValue(
      "launch-2026.04.13.1"
    );
  });

  it("loads the release workspace from an explicit scope deep link", async () => {
    vi.mocked(getLaunchClosureStatus).mockImplementation(async (_session, params) =>
      buildLaunchClosureStatus(
        typeof params.releaseIdentifier === "string"
          ? params.releaseIdentifier
          : null
      )
    );

    renderPage("/launch-readiness?release=launch-2026.04.13.2");

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

    await waitFor(() => {
      expect(vi.mocked(listReleaseReadinessApprovals)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          limit: 20,
          releaseIdentifier: "launch-2026.04.13.2"
        }
      );
    });

    await waitFor(() => {
      expect(vi.mocked(getLaunchClosureStatus)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        {
          releaseIdentifier: "launch-2026.04.13.2"
        }
      );
    });

    expect(screen.getByText("Latest approval")).toBeVisible();
    expect(screen.getByText("Missing evidence")).toBeVisible();
    expect(screen.getAllByText(/critical_alert_reescalation/i).length).toBeGreaterThan(
      0
    );
  });

  it("shows approval drift and newer stored pack state for the selected approval", async () => {
    vi.mocked(getLaunchClosureStatus).mockImplementation(async (_session, params) =>
      buildLaunchClosureStatus(
        typeof params.releaseIdentifier === "string"
          ? params.releaseIdentifier
          : null
      )
    );

    renderPage("/launch-readiness?release=launch-2026.04.13.2");

    await waitFor(() => {
      expect(screen.getByText("Live drift detected")).toBeVisible();
    });

    expect(screen.getByText("Newer pack available")).toBeVisible();
    expect(screen.getByText(/missing evidence resolved/i)).toBeVisible();
    expect(screen.getAllByText(/critical_alert_reescalation/i).length).toBeGreaterThan(
      0
    );
  });

  it("requires rollback metadata before recording rollback drill evidence", async () => {
    renderPage("/launch-readiness?release=launch-2026.04.13.1");

    await waitFor(() => {
      expect(screen.getByLabelText("Release scope")).toHaveValue(
        "launch-2026.04.13.1"
      );
    });

    fireEvent.change(screen.getByLabelText("Evidence type"), {
      target: {
        value: "api_rollback_drill"
      }
    });
    fireEvent.change(screen.getByLabelText("Evidence summary"), {
      target: {
        value: "API rollback drill completed."
      }
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I verified the environment label, summary, and linked evidence/i
      })
    );

    expect(
      screen.getByRole("button", { name: "Record evidence" })
    ).toBeDisabled();
    expect(
      screen.getByText(
        /requires release identifier, rollback release identifier/i
      )
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Evidence release identifier"), {
      target: {
        value: "launch-2026.04.13.1"
      }
    });

    expect(
      screen.getByRole("button", { name: "Record evidence" })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Evidence rollback release identifier"), {
      target: {
        value: "launch-rollback-2026.04.12.4"
      }
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Record evidence" })
      ).toBeEnabled();
    });
  });

  it(
    "requires rollback release identifier before requesting governed approval",
    async () => {
    renderPage("/launch-readiness?release=launch-2026.04.13.1");

    await waitFor(() => {
      expect(screen.getByLabelText("Release scope")).toHaveValue(
        "launch-2026.04.13.1"
      );
    });

    fireEvent.change(screen.getByLabelText("Approval release identifier"), {
      target: {
        value: "launch-2026.04.13.1"
      }
    });
    fireEvent.change(screen.getByLabelText("Approval summary"), {
      target: {
        value: "Production-like candidate is ready for governed approval."
      }
    });
    for (const label of [
      "Security configuration complete",
      "Access and governance complete",
      "Data and recovery complete",
      "Platform health complete",
      "Functional proof complete",
      "Contract and chain proof complete",
      "Final signoff complete",
      "Residual risks explicitly accepted"
    ]) {
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
    }
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I verified the checklist attestations and current evidence before requesting approval/i
      })
    );

    expect(
      screen.getByRole("button", { name: "Request approval" })
    ).toBeDisabled();
    expect(screen.getByText(/rollback target required/i)).toBeVisible();
    expect(
      screen.getByText(/missing fields: rollback release identifier/i)
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Approval rollback release identifier"), {
      target: {
        value: "launch-rollback-2026.04.12.4"
      }
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Request approval" })
      ).toBeEnabled();
    });
    },
    10000
  );
});
