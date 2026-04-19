import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  DepositSettlementReplayAction,
  DepositSettlementReplayApprovalRequestStatus,
  PolicyDecision,
  TransactionIntentStatus
} from "@prisma/client";
import { DepositSettlementReconciliationService } from "./deposit-settlement-reconciliation.service";

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

function createRecord(
  overrides: Partial<{
    id: string;
    status: TransactionIntentStatus;
    policyDecision: PolicyDecision;
    blockchainStatus: BlockchainTransactionStatus | null;
    hasLedgerJournal: boolean;
    hasSettlementProof: boolean;
    settledAmount: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: "account_1",
    destinationWalletId: "wallet_1",
    chainId: 8453,
    status: overrides.status ?? TransactionIntentStatus.broadcast,
    policyDecision: overrides.policyDecision ?? PolicyDecision.approved,
    requestedAmount: { toString: () => "5.00" },
    settledAmount:
      overrides.settledAmount === null
        ? null
        : { toString: () => overrides.settledAmount ?? "5.00" },
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453
    },
    destinationWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000abc"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe"
      }
    },
    blockchainTransactions: overrides.blockchainStatus
      ? [
          {
            id: "chain_tx_1",
            txHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            status: overrides.blockchainStatus,
            fromAddress: null,
            toAddress: null,
            createdAt: new Date("2026-04-01T10:05:00.000Z"),
            updatedAt: new Date("2026-04-01T10:05:00.000Z"),
            confirmedAt:
              overrides.blockchainStatus === BlockchainTransactionStatus.confirmed
                ? new Date("2026-04-01T10:06:00.000Z")
                : null
          }
        ]
      : [],
    ledgerJournals: overrides.hasLedgerJournal
      ? [
          {
            id: "journal_1",
            journalType: "deposit_settlement",
            postedAt: new Date("2026-04-01T10:07:00.000Z"),
            createdAt: new Date("2026-04-01T10:07:00.000Z")
          }
        ]
      : [],
    depositSettlementProof: overrides.hasSettlementProof
      ? {
          id: "proof_1",
          ledgerJournalId: "journal_1",
          blockchainTransactionId: "chain_tx_1",
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          settledAmount: { toString: () => overrides.settledAmount ?? "5.00" },
          confirmedAt: new Date("2026-04-01T10:06:00.000Z"),
          createdAt: new Date("2026-04-01T10:07:00.000Z")
        }
      : null
  };
}

function createApprovalRequest(
  overrides: Partial<{
    id: string;
    transactionIntentId: string;
    replayAction: DepositSettlementReplayAction;
    status: DepositSettlementReplayApprovalRequestStatus;
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
    replayAction: overrides.replayAction ?? DepositSettlementReplayAction.confirm,
    status:
      overrides.status ??
      DepositSettlementReplayApprovalRequestStatus.pending_approval,
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

function createService() {
  const prismaTransaction = {
    depositSettlementReplayApprovalRequest: {
      create: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const prismaService = {
    transactionIntent: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    depositSettlementReplayApprovalRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
    ,
    $transaction: jest.fn(async (callback: (tx: typeof prismaTransaction) => unknown) =>
      callback(prismaTransaction)
    )
  };

  const transactionIntentsService = {
    replayConfirmDepositIntent: jest.fn(),
    replaySettleConfirmedDepositIntent: jest.fn()
  };

  const reviewCasesService = {} as never;

  const service = new DepositSettlementReconciliationService(
    prismaService as never,
    transactionIntentsService as never,
    reviewCasesService
  );

  return {
    service,
    prismaService,
    transactionIntentsService,
    prismaTransaction
  };
}

describe("DepositSettlementReconciliationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("classifies replayable and healthy settlement states", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createRecord({
        id: "intent_confirm",
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      }),
      createRecord({
        id: "intent_settle",
        status: TransactionIntentStatus.confirmed,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      }),
      createRecord({
        id: "intent_healthy",
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        hasSettlementProof: true,
        settledAmount: "5.00"
      })
    ]);

    const result = await service.listDepositSettlementReconciliation({
      limit: 20
    });

    expect(result.summary.ready_for_confirm_replay).toBe(1);
    expect(result.summary.ready_for_settle_replay).toBe(1);
    expect(result.summary.healthy_settled).toBe(1);
    expect(result.actionableCount).toBe(2);
  });

  it("creates a governed replay approval request for a replayable deposit", async () => {
    const { service, prismaService, prismaTransaction } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      })
    );

    prismaService.depositSettlementReplayApprovalRequest.findFirst.mockResolvedValue(
      null
    );
    prismaTransaction.depositSettlementReplayApprovalRequest.create.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm
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
    expect(result.request.replayAction).toBe(DepositSettlementReplayAction.confirm);
    expect(
      prismaTransaction.depositSettlementReplayApprovalRequest.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionIntentId: "intent_1",
        replayAction: DepositSettlementReplayAction.confirm,
        requestedByOperatorId: "ops_1",
        requestedByOperatorRole: "operations_admin"
      }),
      include: expect.any(Object)
    });
  });

  it("reuses an approved deposit replay approval request for the same requester", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      })
    );

    prismaService.depositSettlementReplayApprovalRequest.findFirst.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm,
        status: DepositSettlementReplayApprovalRequestStatus.approved,
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
      DepositSettlementReplayApprovalRequestStatus.approved
    );
  });

  it("approves a pending deposit replay approval request", async () => {
    const { service, prismaService, prismaTransaction } = createService();

    prismaService.depositSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm
      })
    );
    prismaTransaction.depositSettlementReplayApprovalRequest.update.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm,
        status: DepositSettlementReplayApprovalRequestStatus.approved,
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
      DepositSettlementReplayApprovalRequestStatus.approved
    );
  });

  it("rejects a pending deposit replay approval request with audit evidence", async () => {
    const { service, prismaService, prismaTransaction } = createService();

    prismaService.depositSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm
      })
    );
    prismaTransaction.depositSettlementReplayApprovalRequest.update.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm,
        status: DepositSettlementReplayApprovalRequestStatus.rejected,
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
      DepositSettlementReplayApprovalRequestStatus.rejected
    );
  });

  it("replays confirm only with a governed approval request from a different operator", async () => {
    const { service, prismaService, transactionIntentsService, prismaTransaction } =
      createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      })
    );
    prismaService.depositSettlementReplayApprovalRequest.findUnique
      .mockResolvedValueOnce(
        createApprovalRequest({
          replayAction: DepositSettlementReplayAction.confirm,
          status: DepositSettlementReplayApprovalRequestStatus.approved,
          approvedByOperatorId: "ops_approver",
          approvedByOperatorRole: "operations_admin",
          approvedAt: new Date("2026-04-01T11:05:00.000Z"),
          approvalNote: "Approved replay."
        })
      )
      .mockResolvedValueOnce(
        createApprovalRequest({
          replayAction: DepositSettlementReplayAction.confirm,
          status: DepositSettlementReplayApprovalRequestStatus.executed,
          approvedByOperatorId: "ops_approver",
          approvedByOperatorRole: "operations_admin",
          approvedAt: new Date("2026-04-01T11:05:00.000Z"),
          approvalNote: "Approved replay.",
          executedByOperatorId: "ops_approver",
          executedByOperatorRole: "operations_admin",
          executedAt: new Date("2026-04-01T11:05:00.000Z")
        })
      );
    transactionIntentsService.replayConfirmDepositIntent.mockResolvedValue({
      confirmReused: false
    });
    prismaTransaction.depositSettlementReplayApprovalRequest.update.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm,
        status: DepositSettlementReplayApprovalRequestStatus.executed,
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

    expect(
      transactionIntentsService.replayConfirmDepositIntent
    ).not.toHaveBeenCalled();

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
      DepositSettlementReplayApprovalRequestStatus.executed
    );
    expect(
      transactionIntentsService.replayConfirmDepositIntent
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
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        hasSettlementProof: true,
        settledAmount: "5.00"
      })
    );

    await expect(
      service.replaySettle("intent_1", "ops_1", "operations_admin", {
        approvalRequestId: "approval_1"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects self-approval for governed deposit replays", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      })
    );
    prismaService.depositSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm,
        status: DepositSettlementReplayApprovalRequestStatus.approved,
        requestedByOperatorId: "ops_1"
      })
    );

    await expect(
      service.replayConfirm("intent_1", "ops_1", "operations_admin", {
        approvalRequestId: "approval_1"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks executing a deposit replay before approval is granted", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      })
    );
    prismaService.depositSettlementReplayApprovalRequest.findUnique.mockResolvedValue(
      createApprovalRequest({
        replayAction: DepositSettlementReplayAction.confirm,
        status: DepositSettlementReplayApprovalRequestStatus.pending_approval
      })
    );

    await expect(
      service.replayConfirm("intent_1", "ops_2", "operations_admin", {
        approvalRequestId: "approval_1"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("flags settled deposits with missing proof anchors as manual-review-required", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createRecord({
        id: "intent_missing_proof",
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        hasSettlementProof: false,
        settledAmount: "5.00"
      })
    ]);

    const result = await service.listDepositSettlementReconciliation({
      limit: 10
    });

    expect(result.summary.manual_review_required).toBe(1);
    expect(result.items[0]?.reconciliation.reasonCode).toBe(
      "missing_settlement_proof"
    );
  });
});
