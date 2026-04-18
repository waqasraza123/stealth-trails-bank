import {
  GovernedExecutionOverrideRequestStatus,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { GovernedExecutionService } from "./governed-execution.service";

const mockConfig: {
  environment: "production";
  governedExecutionRequiredInProduction: boolean;
  governedReserveCustodyTypes: WalletCustodyType[];
  loanFundingExecutionMode: "direct_private_key" | "governed_external";
  stakingWriteExecutionMode: "direct_private_key" | "governed_external";
  requestAllowedOperatorRoles: string[];
  approverAllowedOperatorRoles: string[];
  overrideMaxHours: number;
} = {
  environment: "production" as const,
  governedExecutionRequiredInProduction: true,
  governedReserveCustodyTypes: [
    WalletCustodyType.multisig_controlled,
    WalletCustodyType.contract_controlled
  ],
  loanFundingExecutionMode: "direct_private_key" as const,
  stakingWriteExecutionMode: "direct_private_key" as const,
  requestAllowedOperatorRoles: ["operations_admin", "risk_manager"],
  approverAllowedOperatorRoles: ["compliance_lead", "risk_manager"],
  overrideMaxHours: 12
};

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadGovernedExecutionRuntimeConfig: jest.fn(() => mockConfig)
}));

function createWallet(
  overrides?: Partial<{
    id: string;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
    status: WalletStatus;
  }>
) {
  return {
    id: overrides?.id ?? "wallet_1",
    chainId: 8453,
    address:
      overrides?.address ?? "0x0000000000000000000000000000000000000abc",
    kind: overrides?.kind ?? WalletKind.treasury,
    custodyType:
      overrides?.custodyType ?? WalletCustodyType.multisig_controlled,
    status: overrides?.status ?? WalletStatus.active,
    customerAccount: null,
    createdAt: new Date("2026-04-18T10:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createWorkerHeartbeat(policyControlledWithdrawalReady: boolean) {
  return {
    id: "heartbeat_1",
    workerId: "worker_1",
    environment: WorkerRuntimeEnvironment.production,
    executionMode: WorkerRuntimeExecutionMode.managed,
    lastIterationStatus: "succeeded",
    lastHeartbeatAt: new Date("2026-04-18T10:00:00.000Z"),
    lastIterationStartedAt: new Date("2026-04-18T09:59:30.000Z"),
    lastIterationCompletedAt: new Date("2026-04-18T10:00:00.000Z"),
    consecutiveFailureCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciliationScanRunId: null,
    lastReconciliationScanStartedAt: null,
    lastReconciliationScanCompletedAt: null,
    lastReconciliationScanStatus: null,
    runtimeMetadata: {
      policyControlledWithdrawalReady
    },
    latestIterationMetrics: null,
    createdAt: new Date("2026-04-18T09:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createOverrideRecord(
  overrides?: Partial<{
    id: string;
    status: GovernedExecutionOverrideRequestStatus;
    allowUnsafeWithdrawalExecution: boolean;
    allowDirectLoanFunding: boolean;
    allowDirectStakingWrites: boolean;
    requestedByOperatorId: string;
    requestedByOperatorRole: string;
    expiresAt: Date;
    approvedAt: Date | null;
    approvedByOperatorId: string | null;
    approvedByOperatorRole: string | null;
  }>
) {
  return {
    id: overrides?.id ?? "override_1",
    environment: WorkerRuntimeEnvironment.production,
    status:
      overrides?.status ??
      GovernedExecutionOverrideRequestStatus.pending_approval,
    allowUnsafeWithdrawalExecution:
      overrides?.allowUnsafeWithdrawalExecution ?? false,
    allowDirectLoanFunding: overrides?.allowDirectLoanFunding ?? true,
    allowDirectStakingWrites: overrides?.allowDirectStakingWrites ?? true,
    reasonCode: "temporary_governance_override",
    requestNote: "Need short-lived override",
    requestedByOperatorId: overrides?.requestedByOperatorId ?? "operator_req",
    requestedByOperatorRole:
      overrides?.requestedByOperatorRole ?? "operations_admin",
    requestedAt: new Date("2026-04-18T10:00:00.000Z"),
    expiresAt:
      overrides?.expiresAt ?? new Date("2026-04-18T14:00:00.000Z"),
    approvedByOperatorId: overrides?.approvedByOperatorId ?? null,
    approvedByOperatorRole: overrides?.approvedByOperatorRole ?? null,
    approvalNote: null,
    approvedAt: overrides?.approvedAt ?? null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    rejectionNote: null,
    rejectedAt: null,
    createdAt: new Date("2026-04-18T10:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createService(args?: {
  wallets?: ReturnType<typeof createWallet>[];
  workers?: ReturnType<typeof createWorkerHeartbeat>[];
  overrides?: ReturnType<typeof createOverrideRecord>[];
}) {
  const overrideStore = [...(args?.overrides ?? [])];
  const wallets = args?.wallets ?? [createWallet()];
  const workers = args?.workers ?? [createWorkerHeartbeat(true)];

  const prismaService = {
    wallet: {
      findMany: jest.fn().mockResolvedValue(wallets)
    },
    workerRuntimeHeartbeat: {
      findMany: jest.fn().mockResolvedValue(workers)
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue(undefined)
    },
    governedExecutionOverrideRequest: {
      findMany: jest.fn(async () => [...overrideStore]),
      findFirst: jest.fn(async ({ where }: { where: { status?: string } }) => {
        if (where.status) {
          return (
            overrideStore.find((record) => record.status === where.status) ?? null
          );
        }

        return overrideStore[0] ?? null;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return overrideStore.find((record) => record.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const next = createOverrideRecord({
          id: `override_${overrideStore.length + 1}`,
          status: data.status as GovernedExecutionOverrideRequestStatus,
          allowUnsafeWithdrawalExecution:
            (data.allowUnsafeWithdrawalExecution as boolean) ?? false,
          allowDirectLoanFunding: (data.allowDirectLoanFunding as boolean) ?? false,
          allowDirectStakingWrites:
            (data.allowDirectStakingWrites as boolean) ?? false,
          requestedByOperatorId: data.requestedByOperatorId as string,
          requestedByOperatorRole: data.requestedByOperatorRole as string,
          expiresAt: data.expiresAt as Date
        });
        overrideStore.unshift(next);
        return next;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = overrideStore.findIndex((record) => record.id === where.id);
        const current = overrideStore[index];
        const next = {
          ...current,
          ...data,
          updatedAt: new Date("2026-04-18T10:05:00.000Z")
        };
        overrideStore[index] = next;
        return next;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { status?: { in: GovernedExecutionOverrideRequestStatus[] }; expiresAt?: { lt: Date } }; data: { status: GovernedExecutionOverrideRequestStatus } }) => {
        let count = 0;
        for (const record of overrideStore) {
          if (
            where.status?.in.includes(record.status) &&
            where.expiresAt &&
            record.expiresAt.getTime() < where.expiresAt.lt.getTime()
          ) {
            record.status = data.status;
            count += 1;
          }
        }
        return { count };
      })
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  (prismaService.$transaction as jest.Mock).mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) =>
      callback({
        governedExecutionOverrideRequest: prismaService.governedExecutionOverrideRequest,
        auditEvent: prismaService.auditEvent
      })
  );

  return {
    service: new GovernedExecutionService(prismaService),
    prismaService,
    overrideStore
  };
}

describe("GovernedExecutionService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a healthy workspace when reserve custody and execution modes are governed", async () => {
    mockConfig.loanFundingExecutionMode = "governed_external";
    mockConfig.stakingWriteExecutionMode = "governed_external";

    const { service } = createService({
      wallets: [createWallet()],
      workers: [createWorkerHeartbeat(true)],
      overrides: []
    });

    const result = await service.getWorkspace({
      operatorId: "operator_1",
      operatorRole: "risk_manager"
    });

    expect(result.posture.status).toBe("healthy");
    expect(result.posture.unsafeReserveWalletCount).toBe(0);
  });

  it("classifies unsafe reserve custody and direct execution modes as critical", async () => {
    mockConfig.loanFundingExecutionMode = "direct_private_key";
    mockConfig.stakingWriteExecutionMode = "direct_private_key";

    const { service } = createService({
      wallets: [
        createWallet({
          custodyType: WalletCustodyType.platform_managed
        })
      ],
      workers: [createWorkerHeartbeat(false)],
      overrides: []
    });

    const result = await service.getWorkspace({
      operatorId: "operator_1",
      operatorRole: "risk_manager"
    });

    expect(result.posture.status).toBe("critical");
    expect(
      result.posture.reasons.map((reason) => reason.code)
    ).toEqual(
      expect.arrayContaining([
        "unsafe_reserve_wallet_custody",
        "loan_funding_not_governed",
        "staking_writes_not_governed"
      ])
    );
  });

  it("requires dual-control approval before direct-key execution is allowed", async () => {
    mockConfig.loanFundingExecutionMode = "direct_private_key";
    mockConfig.stakingWriteExecutionMode = "direct_private_key";

    const { service, overrideStore } = createService();

    await expect(service.assertLoanFundingExecutionAllowed()).rejects.toThrow(
      "Loan funding is blocked"
    );

    const requested = await service.requestOverride(
      {
        allowDirectLoanFunding: true,
        allowDirectStakingWrites: true,
        reasonCode: "incident_window",
        expiresInHours: 2
      },
      {
        operatorId: "operator_requester",
        operatorRole: "operations_admin"
      }
    );

    expect(requested.request.status).toBe("pending_approval");

    await service.approveOverride(
      overrideStore[0].id,
      {},
      {
        operatorId: "operator_approver",
        operatorRole: "risk_manager"
      }
    );

    await expect(service.assertLoanFundingExecutionAllowed()).resolves.toBeUndefined();
    await expect(service.assertStakingWriteExecutionAllowed()).resolves.toBeUndefined();
  });

  it("blocks unsafe managed withdrawals when no approved override exists", async () => {
    const { service } = createService({
      overrides: []
    });

    await expect(
      service.assertManagedWithdrawalExecutionAllowed({
        sourceWalletAddress: "0x0000000000000000000000000000000000000abc",
        sourceWalletKind: WalletKind.treasury,
        sourceWalletCustodyType: WalletCustodyType.platform_managed
      })
    ).rejects.toThrow("Managed withdrawal execution is blocked");
  });
});
