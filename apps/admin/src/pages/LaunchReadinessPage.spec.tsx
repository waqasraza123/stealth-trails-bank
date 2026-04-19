import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LaunchReadinessPage } from "./LaunchReadinessPage";
import {
  OperatorSessionProvider,
  operatorSessionStorageKey
} from "@/state/operator-session";
import {
  approveReleaseReadinessApproval,
  getReleaseReadinessApprovalLineage,
  getReleaseReadinessApprovalRecoveryTarget,
  getLaunchClosureStatus,
  getReleaseReadinessSummary,
  listLaunchClosurePacks,
  listPendingReleases,
  listReleaseReadinessApprovalLineageIncidents,
  listReleaseReadinessApprovals,
  listReleaseReadinessEvidence,
  listReleasedReleases,
  rebindReleaseReadinessApprovalPack,
  rejectReleaseReadinessApproval
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getReleaseReadinessSummary: vi.fn(),
  getReleaseReadinessApprovalLineage: vi.fn(),
  getReleaseReadinessApprovalRecoveryTarget: vi.fn(),
  listReleaseReadinessApprovalLineageIncidents: vi.fn(),
  listReleaseReadinessEvidence: vi.fn(),
  listReleaseReadinessApprovals: vi.fn(),
  listPendingReleases: vi.fn(),
  listReleasedReleases: vi.fn(),
  getLaunchClosureStatus: vi.fn(),
  listLaunchClosurePacks: vi.fn(),
  createReleaseReadinessEvidence: vi.fn(),
  requestReleaseReadinessApproval: vi.fn(),
  rebindReleaseReadinessApprovalPack: vi.fn(),
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
    supersedesApprovalId: null,
    supersededByApprovalId: null,
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
    supersededByOperatorId: null,
    supersededByOperatorRole: null,
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
      critical: true,
      blockingReasons: [
        "A newer launch-closure pack is available for this release scope."
      ],
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
    lineageSummary: {
      status: "healthy" as const,
      issueCount: 0,
      actionableApprovalId: `${releaseIdentifier}-approval`,
      isActionable: true
    },
    requestedAt: "2026-04-14T10:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    supersededAt: null,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z"
  };
}

function buildApprovalLineageIntegrity(approvalIds: string[], actionableApprovalId: string | null) {
  return {
    status: "healthy" as const,
    issues: [],
    headApprovalId: approvalIds[approvalIds.length - 1] ?? null,
    tailApprovalId: approvalIds[0] ?? null,
    actionableApprovalId
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
      <OperatorSessionProvider
        serverUrl="http://localhost:9001"
        initialDraft={{
          baseUrl: "http://localhost:9001",
          accessToken: "test-access-token",
          operatorId: "ops_1",
          operatorRole: "operations_admin"
        }}
      >
        <MemoryRouter initialEntries={[initialEntry]}>
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
        baseUrl: "http://localhost:9001"
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
    vi.mocked(listReleaseReadinessApprovalLineageIncidents).mockResolvedValue({
      incidents: [],
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
    vi.mocked(getReleaseReadinessApprovalLineage).mockImplementation(
      async (_session, approvalId) => {
        const releaseIdentifier = approvalId.replace(/-approval$/, "");
        const currentApproval = {
          ...buildApproval(releaseIdentifier),
          id: approvalId
        };

        return {
          approval: currentApproval,
          lineage:
            approvalId === "launch-2026.04.13.2-approval"
              ? [
                  {
                    ...buildApproval("launch-2026.04.13.1"),
                    id: "launch-2026.04.13.1-approval",
                    supersededByApprovalId: approvalId,
                    status: "superseded" as const
                  },
                  currentApproval
                ]
              : [currentApproval],
          currentMutationToken: currentApproval.updatedAt,
          integrity:
            approvalId === "launch-2026.04.13.2-approval"
              ? buildApprovalLineageIntegrity(
                  [
                    "launch-2026.04.13.1-approval",
                    "launch-2026.04.13.2-approval"
                  ],
                  "launch-2026.04.13.2-approval"
                )
              : buildApprovalLineageIntegrity([approvalId], approvalId)
        };
      }
    );
    vi.mocked(getReleaseReadinessApprovalRecoveryTarget).mockImplementation(
      async (_session, approvalId) => ({
        selectedApprovalId: approvalId,
        actionableApproval: {
          ...buildApproval("launch-2026.04.13.2"),
          id: approvalId === "launch-2026.04.13.2-approval"
            ? "launch-2026.04.13.2-approval-replacement"
            : approvalId
        },
        currentMutationToken: "2026-04-14T10:00:00.000Z",
        integrity: buildApprovalLineageIntegrity(
          [approvalId, "launch-2026.04.13.2-approval-replacement"],
          "launch-2026.04.13.2-approval-replacement"
        )
      })
    );
    vi.mocked(rebindReleaseReadinessApprovalPack).mockImplementation(
      async (_session, approvalId, payload) => ({
        approval: {
          ...buildApproval("launch-2026.04.13.2"),
          id: `${approvalId}-rebound`,
          supersedesApprovalId: approvalId,
          launchClosurePack: {
            id: payload.launchClosurePackId,
            version: 4,
            artifactChecksumSha256: "checksum-launch-2026.04.13.2-v4"
          },
          launchClosureDrift: {
            changed: false,
            critical: false,
            blockingReasons: [],
            currentOverallStatus: "ready",
            summaryDelta: {
              passedCheckCount: 0,
              failedCheckCount: 0,
              pendingCheckCount: 0
            },
            missingEvidenceTypesAdded: [],
            missingEvidenceTypesResolved: [],
            failedEvidenceTypesAdded: [],
            failedEvidenceTypesResolved: [],
            staleEvidenceTypesAdded: [],
            staleEvidenceTypesResolved: [],
            openBlockersAdded: [],
            openBlockersResolved: [],
            newerPackAvailable: false,
            latestPack: null
          }
        }
      })
    );
    vi.mocked(approveReleaseReadinessApproval).mockResolvedValue({
      approval: {
        ...buildApproval("launch-2026.04.13.2"),
        id: "launch-2026.04.13.2-approval",
        status: "approved"
      }
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

    await waitFor(
      () => {
        expect(
          vi
            .mocked(getReleaseReadinessSummary)
            .mock.calls.some(
              ([session, params]) =>
                session.operatorId === "ops_1" &&
                params?.releaseIdentifier === "launch-2026.04.13.1"
            )
        ).toBe(true);
      },
      {
        timeout: 5_000
      }
    );

    await waitFor(
      () => {
        expect(
          vi
            .mocked(listReleaseReadinessEvidence)
            .mock.calls.some(
              ([session, params]) =>
                session.operatorId === "ops_1" &&
                params?.limit === 20 &&
                params?.releaseIdentifier === "launch-2026.04.13.1"
            )
        ).toBe(true);
      },
      {
        timeout: 5_000
      }
    );

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
      expect(screen.getByLabelText("Release scope")).toHaveValue(
        "launch-2026.04.13.1"
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

    expect(screen.getByText("Operational posture")).toBeInTheDocument();
    expect(screen.getByText("External operational checks")).toBeInTheDocument();
    expect(
      screen.getByText(/No governed approval request exists for the selected release scope yet/i)
    ).toBeInTheDocument();
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

    expect(screen.getAllByText("Latest approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing evidence").length).toBeGreaterThan(0);
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
      expect(screen.getByText("Live drift detected")).toBeInTheDocument();
    });

    expect(screen.getByText("Newer pack available")).toBeInTheDocument();
    expect(
      screen.getByText("Approval is blocked by critical drift")
    ).toBeInTheDocument();
    expect(screen.getByText(/missing evidence resolved/i)).toBeInTheDocument();
    expect(screen.getAllByText(/critical_alert_reescalation/i).length).toBeGreaterThan(
      0
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I reviewed failed checks, stale evidence, and open blockers before deciding/i
      })
    );
    expect(screen.getByRole("button", { name: "Approve release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject release" })).toBeEnabled();
  });

  it("rebinds a blocked approval to the latest stored pack from the console", async () => {
    vi.mocked(getLaunchClosureStatus).mockImplementation(async (_session, params) =>
      buildLaunchClosureStatus(
        typeof params.releaseIdentifier === "string"
          ? params.releaseIdentifier
          : null
      )
    );

    renderPage("/launch-readiness?release=launch-2026.04.13.2");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Rebind to latest pack" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rebind to latest pack" }));

    await waitFor(() => {
      expect(vi.mocked(rebindReleaseReadinessApprovalPack)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        "launch-2026.04.13.2-approval",
        {
          launchClosurePackId: "launch-2026.04.13.2-pack-v4",
          expectedUpdatedAt: "2026-04-14T10:00:00.000Z"
        }
      );
    });
  });

  it("pins approval actions to the actionable lineage node", async () => {
    vi.mocked(getReleaseReadinessApprovalLineage).mockResolvedValueOnce({
      approval: {
        ...buildApproval("launch-2026.04.13.2"),
        id: "launch-2026.04.13.2-approval"
      },
      lineage: [
        {
          ...buildApproval("launch-2026.04.13.2"),
          id: "launch-2026.04.13.2-approval"
        },
        {
          ...buildApproval("launch-2026.04.13.2"),
          id: "launch-2026.04.13.2-approval-replacement"
        }
      ],
      currentMutationToken: "2026-04-14T10:00:00.000Z",
      integrity: {
        status: "critical" as const,
        issues: [
          {
            code: "multiple_pending_approvals" as const,
            approvalId: "launch-2026.04.13.2-approval",
            relatedApprovalId: null,
            description:
              "Approval launch-2026.04.13.2-approval is pending while another approval in the same lineage is also pending."
          }
        ],
        headApprovalId: "launch-2026.04.13.2-approval-replacement",
        tailApprovalId: "launch-2026.04.13.2-approval",
        actionableApprovalId: "launch-2026.04.13.2-approval-replacement"
      }
    });

    renderPage("/launch-readiness?release=launch-2026.04.13.2");

    expect(
      await screen.findByText("Approval actions are pinned to the actionable lineage node")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View actionable approval" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rebind to latest pack" })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "View actionable approval" }));

    await waitFor(() => {
      expect(vi.mocked(getReleaseReadinessApprovalRecoveryTarget)).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: "ops_1"
        }),
        "launch-2026.04.13.2-approval"
      );
    });
  });

  it("surfaces lineage incidents in the approval chain list before selection", async () => {
    vi.mocked(listReleaseReadinessApprovals).mockResolvedValueOnce({
      approvals: [
        {
          ...buildApproval("launch-2026.04.13.1"),
          lineageSummary: {
            status: "critical",
            issueCount: 2,
            actionableApprovalId: "launch-2026.04.13.1-approval-replacement",
            isActionable: false
          }
        }
      ],
      limit: 20,
      totalCount: 1
    });

    renderPage("/launch-readiness?release=launch-2026.04.13.1");

    expect(await screen.findByText("Lineage incidents need review")).toBeInTheDocument();
    expect(screen.getByText("Lineage Critical")).toBeInTheDocument();
    expect(screen.getByText("2 issues")).toBeInTheDocument();
    expect(
      screen.getByText("Continue with launch-2026.04.13.1-approval-replacement")
    ).toBeInTheDocument();
  });

  it("loads the cross-release lineage incident feed", async () => {
    vi.mocked(listReleaseReadinessApprovalLineageIncidents).mockResolvedValue({
      incidents: [
        {
          ...buildApproval("launch-2026.04.13.9"),
          id: "launch-2026.04.13.9-approval-stale",
          lineageSummary: {
            status: "warning",
            issueCount: 0,
            actionableApprovalId: "launch-2026.04.13.9-approval-current",
            isActionable: false
          }
        }
      ],
      limit: 20,
      totalCount: 1
    });

    renderPage("/launch-readiness");

    await waitFor(() => {
      expect(
        vi.mocked(listReleaseReadinessApprovalLineageIncidents)
      ).toHaveBeenCalledWith(
        expect.any(Object),
        {
          limit: 20
        }
      );
    });
  });

  it("renders the selected approval lineage from the dedicated lineage endpoint", async () => {
    renderPage("/launch-readiness?release=launch-2026.04.13.2");

    expect(await screen.findByText("Approval lineage")).toBeInTheDocument();
    expect(screen.getByText("Lineage integrity")).toBeInTheDocument();
    expect(screen.getByText("Lineage head")).toBeInTheDocument();
    expect(screen.getAllByText("launch-2026.04.13.2-approval").length).toBeGreaterThan(0);
    expect(screen.getByText("Actionable approval")).toBeInTheDocument();
    expect(vi.mocked(getReleaseReadinessApprovalLineage)).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: "ops_1"
      }),
      "launch-2026.04.13.2-approval"
    );
    expect(
      await screen.findByRole("button", { name: /launch-2026.04.13.1-approval/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /launch-2026.04.13.2-approval/i })
    ).toBeInTheDocument();
  });

  it("keeps superseded approvals read-only for historical review", async () => {
    vi.mocked(getReleaseReadinessApprovalLineage).mockResolvedValueOnce({
      approval: {
        ...buildApproval("launch-2026.04.13.1"),
        id: "launch-2026.04.13.1-approval",
        status: "superseded" as const,
        supersededByApprovalId: "launch-2026.04.13.1-approval-rebound",
        supersededByOperatorId: "ops_2",
        supersededByOperatorRole: "operations_admin",
        supersededAt: "2026-04-14T11:00:00.000Z"
      },
      lineage: [
        {
          ...buildApproval("launch-2026.04.13.1"),
          id: "launch-2026.04.13.1-approval",
          status: "superseded" as const,
          supersededByApprovalId: "launch-2026.04.13.1-approval-rebound",
          supersededByOperatorId: "ops_2",
          supersededByOperatorRole: "operations_admin",
          supersededAt: "2026-04-14T11:00:00.000Z"
        }
      ],
      currentMutationToken: "2026-04-14T10:00:00.000Z",
      integrity: {
        status: "critical" as const,
        issues: [
          {
            code: "superseded_head" as const,
            approvalId: "launch-2026.04.13.1-approval",
            relatedApprovalId: "launch-2026.04.13.1-approval-rebound",
            description:
              "Latest approval launch-2026.04.13.1-approval is superseded but has no valid replacement in the loaded lineage."
          }
        ],
        headApprovalId: "launch-2026.04.13.1-approval",
        tailApprovalId: "launch-2026.04.13.1-approval",
        actionableApprovalId: null
      }
    });

    vi.mocked(listReleaseReadinessApprovals).mockResolvedValueOnce({
      approvals: [
        {
          ...buildApproval("launch-2026.04.13.1"),
          status: "superseded" as const,
          supersededByApprovalId: "launch-2026.04.13.1-approval-rebound",
          supersededByOperatorId: "ops_2",
          supersededByOperatorRole: "operations_admin",
          supersededAt: "2026-04-14T11:00:00.000Z"
        }
      ],
      limit: 20,
      totalCount: 1
    });

    renderPage(
      "/launch-readiness?release=launch-2026.04.13.1&approval=launch-2026.04.13.1-approval"
    );

    expect(
      (await screen.findAllByText("launch-2026.04.13.1-approval")).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Approve release" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reject release" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Rebind to latest pack" })
    ).toBeInTheDocument();
  });

  it("shows an explicit refresh recovery flow for stale approval conflicts", async () => {
    vi.mocked(rejectReleaseReadinessApproval).mockRejectedValueOnce(
      new Error(
        "Launch approval changed after it was loaded. Refresh approval data and retry."
      )
    );

    renderPage("/launch-readiness?release=launch-2026.04.13.2");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Reject release" })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I reviewed failed checks, stale evidence, and open blockers before deciding/i
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject release" }));

    expect(
      await screen.findByText("Approval snapshot is stale")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Refresh the approval workspace to reload the latest state and retry the action/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Action failed")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh approval workspace" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh approval workspace" })
    );

    expect(
      await screen.findByText("Approval workspace refreshed.")
    ).toBeInTheDocument();
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
    ).toBeInTheDocument();

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
    await waitFor(() => {
      expect(screen.getByText("Immutable pack selected")).toBeInTheDocument();
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
    expect(screen.getByText(/rollback target required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/missing fields: rollback release identifier/i)
    ).toBeInTheDocument();

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
