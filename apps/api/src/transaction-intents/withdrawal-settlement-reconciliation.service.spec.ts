import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  TransactionIntentStatus,
  WithdrawalSettlementReplayAction,
  WithdrawalSettlementReplayApprovalRequestStatus
} from "@prisma/client";
import { WithdrawalSettlementReconciliationService } from "./withdrawal-settlement-reconciliation.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadSensitiveOperatorActionPolicyRuntimeConfig: () => ({
    custodyOperationAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "treasury"
    ]
  })
}));

function buildRecord(
  overrides: {
    id?: string;
    status?: TransactionIntentStatus;
    blockchainStatus?: BlockchainTransactionStatus | null;
    hasLedgerJournal?: boolean;
    settledAmount?: string | null;
  } = {}
) {
  const blockchainTransactions =
    overrides.blockchainStatus === null
      ? []
      : [
          {
            id: "tx_1",
            txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
            status:
              overrides.blockchainStatus ?? BlockchainTransactionStatus.broadcast,
            fromAddress: "0x0000000000000000000000000000000000000def",
            toAddress: "0x0000000000000000000000000000000000000abc",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            confirmedAt:
              overrides.blockchainStatus === BlockchainTransactionStatus.confirmed
                ? new Date("2026-04-01T00:05:00.000Z")
                : null
          }
        ];

  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: "account_1",
    sourceWalletId: "wallet_1",
    externalAddress: "0x0000000000000000000000000000000000000abc",
    chainId: 8453,
    status: overrides.status ?? TransactionIntentStatus.broadcast,
    policyDecision: PolicyDecision.approved,
    requestedAmount: {
      toString: () => "30"
    },
    settledAmount:
      overrides.settledAmount === undefined
        ? null
        : overrides.settledAmount === null
          ? null
          : {
              toString: () => overrides.settledAmount as string
            },
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    sourceWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000def"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      }
    },
    blockchainTransactions,
    ledgerJournals: overrides.hasLedgerJournal
      ? [
          {
            id: "journal_1",
            journalType: "withdrawal_settlement",
            postedAt: new Date("2026-04-01T00:10:00.000Z"),
            createdAt: new Date("2026-04-01T00:10:00.000Z")
          }
        ]
      : []
  };
}

function createApprovalRequest(
  overrides: Partial<{
    id: string;
    transactionIntentId: string;
    replayAction: WithdrawalSettlementReplayAction;
    status: WithdrawalSettlementReplayApprovalRequestStatus;
    requestedByOperatorId: string;
    requestedByOperatorRole: string;
    requestNote: string | null;
    approvedByOperatorId: string | null;
    approvedByOperatorRole: string | null;
    approvalNote: string | null;
    approvedAt: Date | null;
    rejectedByOperatorId: string | null;
    rejectedByOperatorRole: string | null;
    rejectionNote: string | null;
    rejectedAt: Date | null;
    executedByOperatorId: string | null;
    executedByOperatorRole: string | null;
    executedAt: Date | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "approval_1",
    transactionIntentId: overrides.transactionIntentId ?? "intent_1",
    transactionIntent: {
      id: overrides.transactionIntentId ?? "intent_1",
      chainId: 8453
    },
    chainId: 8453,
    replayAction: overrides.replayAction ?? WithdrawalSettlementReplayAction.confirm,
    status:
      overrides.status ??
      WithdrawalSettlementReplayApprovalRequestStatus.pending_approval,
    requestedByOperatorId: overrides.requestedByOperatorId ?? "ops_requester",
    requestedByOperatorRole:
      overrides.requestedByOperatorRole ?? "operations_admin",
    requestNote: overrides.requestNote ?? "Please approve replay.",
    requestedAt: new Date("2026-04-01T11:00:00.000Z"),
    approvedByOperatorId: overrides.approvedByOperatorId ?? null,
    approvedByOperatorRole: overrides.approvedByOperatorRole ?? null,
    approvalNote: overrides.approvalNote ?? null,
    approvedAt: overrides.approvedAt ?? null,
    rejectedByOperatorId: overrides.rejectedByOperatorId ?? null,
    rejectedByOperatorRole: overrides.rejectedByOperatorRole ?? null,
    rejectionNote: overrides.rejectionNote ?? null,
    rejectedAt: overrides.rejectedAt ?? null,
    executedByOperatorId: overrides.executedByOperatorId ?? null,
    executedByOperatorRole: overrides.executedByOperatorRole ?? null,
    executedAt: overrides.executedAt ?? null,
    createdAt: new Date("2026-04-01T11:00:00.000Z"),
    updatedAt: new Date("2026-04-01T11:00:00.000Z")
  };
}

function createService(records: any[] = []) {
  const prismaTransaction = {
    withdrawalSettlementReplayApprovalRequest: {
      create: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const prismaService = {
    transactionIntent: {
      findMany: jest.fn().mockResolvedValue(records),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const intentId = where.id;
        return Promise.resolve(
          records.find((record) => record.id === intentId) ?? null
        );
      })
    },
    withdrawalSettlementReplayApprovalRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    $transaction: jest.fn(async (callback: (tx: typeof prismaTransaction) => unknown) =>
      callback(prismaTransaction)
    )
  } as any;

  const withdrawalIntentsService = {
    replayConfirmWithdrawalIntent: jest.fn(),
    replaySettleConfirmedWithdrawalIntent: jest.fn()
  } as any;

  const reviewCasesService = {} as never;

  const service = new WithdrawalSettlementReconciliationService(
    prismaService as never,
    withdrawalIntentsService as never,
    reviewCasesService
  );

  return {
    service,
    prismaService,
    withdrawalIntentsService,
    prismaTransaction
  };
}

describe("WithdrawalSettlementReconciliationService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("classifies replayable and healthy withdrawal settlement states", async () => {
    const records = [
      buildRecord({
        id: "intent_1",
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false
      }),
      buildRecord({
        id: "intent_2",
        status: TransactionIntentStatus.confirmed,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false
      }),
      buildRecord({
        id: "intent_3",
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        settledAmount: "30"
      })
    ];

    const { service } = createService(records);

    const result = await service.listWithdrawalSettlementReconciliation({});

    expect(result.summary.ready_for_confirm_replay).toBe(1);
    expect(result.summary.ready_for_settle_replay).toBe(1);
    expect(result.summary.healthy_settled).toBe(1);
  });

  it("creates a governed replay approval request for a replayable withdrawal", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService, prismaTransaction } = createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findFirst.mockResolvedValue(
      null
    );
    prismaTransaction.withdrawalSettlementReplayApprovalRequest.create.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm
      })
    );
    prismaTransaction.auditEvent.create.mockResolvedValue({ id: "audit_1" });

    const result = await service.requestReplayApproval(
      "intent_1",
      "ops_1",
      "operations_admin",
      {
        replayAction: "confirm",
        note: "Replay missed confirm."
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.request.replayAction).toBe(
      WithdrawalSettlementReplayAction.confirm
    );
  });

  it("reuses an approved withdrawal replay approval request for the same requester", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService } = createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findFirst.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm,
        status: WithdrawalSettlementReplayApprovalRequestStatus.approved,
        requestedByOperatorId: "ops_1",
        approvedByOperatorId: "ops_2",
        approvedByOperatorRole: "operations_admin",
        approvedAt: new Date("2026-04-01T11:05:00.000Z")
      })
    );

    const result = await service.requestReplayApproval(
      "intent_1",
      "ops_1",
      "operations_admin",
      {
        replayAction: "confirm"
      }
    );

    expect(result.stateReused).toBe(true);
    expect(result.request.status).toBe(
      WithdrawalSettlementReplayApprovalRequestStatus.approved
    );
  });

  it("approves a pending withdrawal replay approval request", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService, prismaTransaction } = createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm
      })
    );
    prismaTransaction.withdrawalSettlementReplayApprovalRequest.update.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm,
        status: WithdrawalSettlementReplayApprovalRequestStatus.approved,
        approvedByOperatorId: "ops_approver",
        approvedByOperatorRole: "operations_admin",
        approvalNote: "Approved from queue.",
        approvedAt: new Date("2026-04-01T11:05:00.000Z")
      })
    );
    prismaTransaction.auditEvent.create.mockResolvedValue({ id: "audit_1" });

    const result = await service.approveReplayApprovalRequest(
      "approval_1",
      "ops_approver",
      "operations_admin",
      "Approved from queue."
    );

    expect(result.stateReused).toBe(false);
    expect(result.request.status).toBe(
      WithdrawalSettlementReplayApprovalRequestStatus.approved
    );
  });

  it("rejects a pending withdrawal replay approval request with audit evidence", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService, prismaTransaction } = createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm
      })
    );
    prismaTransaction.withdrawalSettlementReplayApprovalRequest.update.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm,
        status: WithdrawalSettlementReplayApprovalRequestStatus.rejected,
        rejectedByOperatorId: "ops_reviewer",
        rejectedByOperatorRole: "operations_admin",
        rejectionNote: "Rejected from queue.",
        rejectedAt: new Date("2026-04-01T11:05:00.000Z")
      })
    );
    prismaTransaction.auditEvent.create.mockResolvedValue({ id: "audit_1" });

    const result = await service.rejectReplayApprovalRequest(
      "approval_1",
      "ops_reviewer",
      "operations_admin",
      "Rejected from queue."
    );

    expect(result.stateReused).toBe(false);
    expect(result.request.status).toBe(
      WithdrawalSettlementReplayApprovalRequestStatus.rejected
    );
  });

  it("replays confirm only with a governed approval request from a different operator", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService, withdrawalIntentsService, prismaTransaction } =
      createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findUnique
      .mockResolvedValueOnce(
        createApprovalRequest({
          replayAction: WithdrawalSettlementReplayAction.confirm,
          status: WithdrawalSettlementReplayApprovalRequestStatus.approved,
          approvedByOperatorId: "ops_approver",
          approvedByOperatorRole: "operations_admin",
          approvedAt: new Date("2026-04-01T11:05:00.000Z"),
          approvalNote: "Approved replay."
        })
      )
      .mockResolvedValueOnce(
        createApprovalRequest({
          replayAction: WithdrawalSettlementReplayAction.confirm,
          status: WithdrawalSettlementReplayApprovalRequestStatus.executed,
          approvedByOperatorId: "ops_approver",
          approvedByOperatorRole: "operations_admin",
          approvedAt: new Date("2026-04-01T11:05:00.000Z"),
          approvalNote: "Approved replay.",
          executedByOperatorId: "ops_approver",
          executedByOperatorRole: "operations_admin",
          executedAt: new Date("2026-04-01T11:06:00.000Z")
        })
      );
    withdrawalIntentsService.replayConfirmWithdrawalIntent.mockResolvedValue({
      confirmReused: false
    });
    prismaTransaction.withdrawalSettlementReplayApprovalRequest.update.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm,
        status: WithdrawalSettlementReplayApprovalRequestStatus.executed,
        approvedByOperatorId: "ops_approver",
        approvedByOperatorRole: "operations_admin",
        approvedAt: new Date("2026-04-01T11:05:00.000Z"),
        approvalNote: "Approved replay.",
        executedByOperatorId: "ops_approver",
        executedByOperatorRole: "operations_admin",
        executedAt: new Date("2026-04-01T11:06:00.000Z")
      })
    );
    prismaTransaction.auditEvent.create.mockResolvedValue({ id: "audit_1" });

    const result = await service.replayConfirm(
      "intent_1",
      "ops_approver",
      "operations_admin",
      {
        approvalRequestId: "approval_1",
        note: "Replay missed confirm."
      }
    );

    expect(result.confirmReused).toBe(false);
    expect(result.approvalRequest.status).toBe(
      WithdrawalSettlementReplayApprovalRequestStatus.executed
    );
    expect(
      withdrawalIntentsService.replayConfirmWithdrawalIntent
    ).toHaveBeenCalledWith(
      "intent_1",
      "ops_approver",
      "Replay missed confirm.",
      "operations_admin",
      {
        approvalRequestId: "approval_1",
        requestedByOperatorId: "ops_requester",
        requestedByOperatorRole: "operations_admin"
      }
    );
  });

  it("rejects settle replay when the classification is not settle-replayable", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.settled,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: true,
      settledAmount: "30"
    });

    const { service } = createService([record]);

    await expect(
      service.replaySettle("intent_1", "ops_1", "operations_admin", {
        approvalRequestId: "approval_1"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects self-approval for governed withdrawal replays", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService } = createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm,
        status: WithdrawalSettlementReplayApprovalRequestStatus.approved,
        requestedByOperatorId: "ops_1"
      })
    );

    await expect(
      service.replayConfirm("intent_1", "ops_1", "operations_admin", {
        approvalRequestId: "approval_1"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks executing a withdrawal replay before approval is granted", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, prismaService } = createService([record]);

    prismaService.withdrawalSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: WithdrawalSettlementReplayAction.confirm,
        status: WithdrawalSettlementReplayApprovalRequestStatus.pending_approval
      })
    );

    await expect(
      service.replayConfirm("intent_1", "ops_2", "operations_admin", {
        approvalRequestId: "approval_1"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
