import {
  AccountLifecycleStatus,
  AssetStatus,
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType,
  WalletStatus
} from "@prisma/client";

type CustomerRecord = {
  id: string;
  supabaseUserId: string;
  email: string;
  firstName: string;
  lastName: string;
};

type WalletRecord = {
  id: string;
  address: string;
  chainId: number;
  status: WalletStatus;
  createdAt: Date;
};

type CustomerAccountRecord = {
  id: string;
  status: AccountLifecycleStatus;
  customerId: string;
  customer: CustomerRecord;
  wallets: WalletRecord[];
};

type AssetRecord = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  status: AssetStatus;
  assetType: string;
  contractAddress: string | null;
};

type TransactionIntentRecord = {
  id: string;
  customerAccountId: string;
  assetId: string;
  sourceWalletId: string | null;
  destinationWalletId: string | null;
  externalAddress: string | null;
  chainId: number;
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: Prisma.Decimal;
  settledAmount: Prisma.Decimal | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  manualInterventionRequiredAt: Date | null;
  manualInterventionReviewCaseId: string | null;
  executionClaimedAt: Date | null;
  executionClaimedByWorkerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type BlockchainTransactionRecord = {
  id: string;
  transactionIntentId: string;
  chainId: number;
  txHash: string | null;
  nonce: number | null;
  serializedTransaction: string | null;
  status: BlockchainTransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LedgerJournalRecord = {
  id: string;
  transactionIntentId: string;
  createdAt: Date;
};

type AuditEventRecord = {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

type DepositSettlementProofRecord = {
  id: string;
  transactionIntentId: string;
  blockchainTransactionId: string;
  ledgerJournalId: string;
  assetId: string;
  chainId: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  settledAmount: Prisma.Decimal;
  confirmedAt: Date;
  createdAt: Date;
};

type ReviewCaseRecord = {
  id: string;
  customerId: string;
  customerAccountId: string;
  transactionIntentId: string;
  type: string;
  status: string;
  assignedOperatorId: string | null;
  notes: string | null;
  resolvedAt: Date | null;
};

type BalanceRecord = {
  available: Prisma.Decimal;
  pending: Prisma.Decimal;
};

type TransactionIntentFindArgs = {
  where?: Record<string, unknown>;
  orderBy?: {
    createdAt?: "asc" | "desc";
  };
  take?: number;
};

type TransactionIntentMutationData = Partial<
  Omit<
    TransactionIntentRecord,
    "id" | "customerAccountId" | "assetId" | "createdAt" | "updatedAt"
  >
> & {
  settledAmount?: Prisma.Decimal | null;
};

export class FinanceFlowIntegrationHarness {
  readonly productChainId = 8453;
  readonly customer: CustomerRecord = {
    id: "customer_1",
    supabaseUserId: "supabase_1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace"
  };
  readonly wallet: WalletRecord = {
    id: "wallet_1",
    address: "0x0000000000000000000000000000000000000abc",
    chainId: this.productChainId,
    status: WalletStatus.active,
    createdAt: new Date("2026-04-06T18:00:00.000Z")
  };
  readonly asset: AssetRecord = {
    id: "asset_1",
    symbol: "USDC",
    displayName: "USD Coin",
    decimals: 6,
    chainId: this.productChainId,
    status: AssetStatus.active,
    assetType: "erc20",
    contractAddress: "0x00000000000000000000000000000000000000Cd"
  };
  readonly customerAccount: CustomerAccountRecord = {
    id: "account_1",
    status: AccountLifecycleStatus.active,
    customerId: this.customer.id,
    customer: this.customer,
    wallets: [this.wallet]
  };

  private readonly transactionIntents: TransactionIntentRecord[] = [];
  private readonly blockchainTransactions: BlockchainTransactionRecord[] = [];
  private readonly ledgerJournals: LedgerJournalRecord[] = [];
  private readonly auditEvents: AuditEventRecord[] = [];
  private readonly depositSettlementProofs: DepositSettlementProofRecord[] = [];
  private readonly reviewCases: ReviewCaseRecord[] = [];
  private readonly balances = new Map<string, BalanceRecord>();
  private eventSequence = 0;
  private intentSequence = 0;
  private blockchainSequence = 0;
  private journalSequence = 0;
  private auditSequence = 0;

  readonly authService = {
    validateToken: jest.fn(async () => ({
      id: this.customer.supabaseUserId
    })),
    assertCustomerStepUpFresh: jest.fn(async () => undefined)
  };

  readonly prismaService = {
    customerAccount: {
      findFirst: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        this.findCustomerAccount(args)
      )
    },
    asset: {
      findUnique: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        this.findAsset(args)
      ),
      findMany: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        this.findAssets(args)
      )
    },
    transactionIntent: {
      findUnique: jest.fn(
        async (args?: { where?: Record<string, unknown> }) =>
          this.findUniqueTransactionIntent(args)
      ),
      findFirst: jest.fn(async (args?: TransactionIntentFindArgs) =>
        this.findFirstTransactionIntent(args)
      ),
      findMany: jest.fn(async (args?: TransactionIntentFindArgs) =>
        this.findManyTransactionIntents(args)
      )
    },
    depositSettlementProof: {
      findUnique: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        this.findDepositSettlementProof(args)
      )
    },
    ledgerJournal: {
      findUnique: jest.fn(async (args?: { where?: Record<string, unknown> }) =>
        this.findLedgerJournal(args)
      )
    },
    $transaction: jest.fn(async (callback: (tx: typeof this.transactionClient) => unknown) =>
      callback(this.transactionClient)
    )
  };

  readonly ledgerService = {
    reserveWithdrawalBalance: jest.fn(
      async (
        _transaction: unknown,
        args: {
          customerAccountId: string;
          assetId: string;
          amount: Prisma.Decimal;
        }
      ) => this.reserveWithdrawalBalance(args)
    ),
    releaseWithdrawalReservation: jest.fn(
      async (
        _transaction: unknown,
        args: {
          customerAccountId: string;
          assetId: string;
          amount: Prisma.Decimal;
        }
      ) => this.releaseWithdrawalReservation(args)
    ),
    settleConfirmedDeposit: jest.fn(
      async (
        _transaction: unknown,
        args: {
          transactionIntentId: string;
          customerAccountId: string;
          assetId: string;
          amount: Prisma.Decimal;
        }
      ) => this.settleConfirmedDeposit(args)
    ),
    settleConfirmedWithdrawal: jest.fn(
      async (
        _transaction: unknown,
        args: {
          transactionIntentId: string;
          customerAccountId: string;
          assetId: string;
          amount: Prisma.Decimal;
        }
      ) => this.settleConfirmedWithdrawal(args)
    )
  };

  private readonly transactionClient = {
    transactionIntent: {
      create: async (args: { data: Record<string, unknown> }) =>
        this.createTransactionIntent(args.data),
      update: async (args: {
        where: { id: string };
        data: TransactionIntentMutationData;
      }) => this.updateTransactionIntent(args.where.id, args.data),
      updateMany: async (args: {
        where?: Record<string, unknown>;
        data: TransactionIntentMutationData;
      }) => this.updateManyTransactionIntents(args.where, args.data),
      findFirst: async (args?: TransactionIntentFindArgs) =>
        this.findFirstTransactionIntent(args)
    },
    blockchainTransaction: {
      create: async (args: { data: Record<string, unknown> }) =>
        this.createBlockchainTransaction(args.data),
      update: async (args: {
        where: { id: string };
        data: Partial<BlockchainTransactionRecord>;
      }) => this.updateBlockchainTransaction(args.where.id, args.data)
    },
    auditEvent: {
      create: async (args: { data: Record<string, unknown> }) =>
        this.createAuditEvent(args.data)
    },
    reviewCase: {
      findUnique: async (args?: { where?: Record<string, unknown> }) =>
        this.findReviewCase(args),
      update: async (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => this.updateReviewCase(args.where.id, args.data)
    },
    reviewCaseEvent: {
      create: async () => ({
        id: this.nextId("review_case_event", this.eventSequence + 1)
      })
    },
    depositSettlementProof: {
      findUnique: async (args?: { where?: Record<string, unknown> }) =>
        this.findDepositSettlementProof(args),
      create: async (args: { data: Record<string, unknown> }) =>
        this.createDepositSettlementProof(args.data)
    },
    ledgerJournal: {
      findUnique: async (args?: { where?: Record<string, unknown> }) =>
        this.findLedgerJournal(args)
    }
  };

  constructor() {
    this.setAvailableBalance("0");
  }

  setAvailableBalance(amount: string): void {
    this.balances.set(this.getBalanceKey(), {
      available: new Prisma.Decimal(amount),
      pending: new Prisma.Decimal(0)
    });
  }

  getBalanceSnapshot(): {
    available: string;
    pending: string;
  } {
    const balance = this.getOrCreateBalance();

    return {
      available: balance.available.toString(),
      pending: balance.pending.toString()
    };
  }

  hasLedgerJournalForIntent(intentId: string): boolean {
    return this.ledgerJournals.some(
      (ledgerJournal) => ledgerJournal.transactionIntentId === intentId
    );
  }

  getAuditActionsForIntent(intentId: string): string[] {
    return this.auditEvents
      .filter((event) => event.targetId === intentId)
      .map((event) => event.action);
  }

  private getBalanceKey(): string {
    return `${this.customerAccount.id}:${this.asset.id}`;
  }

  private getOrCreateBalance(): BalanceRecord {
    const key = this.getBalanceKey();
    const existingBalance = this.balances.get(key);

    if (existingBalance) {
      return existingBalance;
    }

    const createdBalance = {
      available: new Prisma.Decimal(0),
      pending: new Prisma.Decimal(0)
    };

    this.balances.set(key, createdBalance);
    return createdBalance;
  }

  private nextTimestamp(): Date {
    const timestamp = new Date(
      Date.UTC(2026, 3, 6, 18, 0, this.eventSequence)
    );
    this.eventSequence += 1;
    return timestamp;
  }

  private nextId(prefix: string, sequence: number): string {
    return `${prefix}_${sequence.toString().padStart(4, "0")}`;
  }

  private findCustomerAccount(args?: {
    where?: Record<string, unknown>;
  }): CustomerAccountRecord | null {
    const supabaseUserId = (
      args?.where?.customer as { supabaseUserId?: string } | undefined
    )?.supabaseUserId;

    if (supabaseUserId && supabaseUserId !== this.customer.supabaseUserId) {
      return null;
    }

    return {
      ...this.customerAccount,
      customer: {
        ...this.customer
      },
      wallets: [...this.customerAccount.wallets]
    };
  }

  private findAsset(args?: {
    where?: Record<string, unknown>;
  }): AssetRecord | null {
    const chainIdSymbol = args?.where?.chainId_symbol as
      | {
          chainId?: number;
          symbol?: string;
        }
      | undefined;

    if (chainIdSymbol) {
      if (
        chainIdSymbol.chainId !== this.asset.chainId ||
        chainIdSymbol.symbol !== this.asset.symbol
      ) {
        return null;
      }

      return {
        ...this.asset
      };
    }

    const assetId = args?.where?.id as string | undefined;

    if (assetId && assetId !== this.asset.id) {
      return null;
    }

    return {
      ...this.asset
    };
  }

  private findAssets(args?: {
    where?: Record<string, unknown>;
  }): AssetRecord[] {
    const assetIds =
      ((args?.where?.id as { in?: string[] } | undefined)?.in ?? []) as string[];

    if (assetIds.length === 0 || assetIds.includes(this.asset.id)) {
      return [
        {
          ...this.asset
        }
      ];
    }

    return [];
  }

  private decorateIntent(
    intent: TransactionIntentRecord
  ): Record<string, unknown> {
    const sourceWallet =
      intent.sourceWalletId === this.wallet.id
        ? {
            id: this.wallet.id,
            address: this.wallet.address
          }
        : null;
    const destinationWallet =
      intent.destinationWalletId === this.wallet.id
        ? {
            id: this.wallet.id,
            address: this.wallet.address
          }
        : null;
    const latestBlockchainTransaction = this.blockchainTransactions
      .filter(
        (blockchainTransaction) =>
          blockchainTransaction.transactionIntentId === intent.id
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )[0];

    return {
      ...intent,
      asset: {
        id: this.asset.id,
        symbol: this.asset.symbol,
        displayName: this.asset.displayName,
        decimals: this.asset.decimals,
        chainId: this.asset.chainId
      },
      sourceWallet,
      destinationWallet,
      customerAccount: {
        id: this.customerAccount.id,
        customerId: this.customerAccount.customerId,
        customer: {
          id: this.customer.id,
          supabaseUserId: this.customer.supabaseUserId,
          email: this.customer.email,
          firstName: this.customer.firstName,
          lastName: this.customer.lastName
        }
      },
      blockchainTransactions: latestBlockchainTransaction
        ? [
            {
              ...latestBlockchainTransaction
            }
          ]
        : []
    };
  }

  private matchesIntentWhere(
    intent: TransactionIntentRecord,
    where?: Record<string, unknown>
  ): boolean {
    if (!where) {
      return true;
    }

    const checks = Object.entries(where);

    return checks.every(([key, value]) => {
      if (typeof value === "undefined") {
        return true;
      }

      if (key === "OR" && Array.isArray(value)) {
        return value.some(
          (branch) =>
            typeof branch === "object" &&
            branch !== null &&
            this.matchesIntentWhere(
              intent,
              branch as Record<string, unknown>
            )
        );
      }

      const candidate = intent[key as keyof TransactionIntentRecord];

      if (value === null) {
        return candidate === null;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        "in" in value
      ) {
        const candidates = (value as { in?: unknown[] }).in;

        return Array.isArray(candidates) ? candidates.includes(candidate) : false;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        "lte" in value &&
        candidate instanceof Date
      ) {
        const threshold = (value as { lte?: Date }).lte;

        return threshold instanceof Date
          ? candidate.getTime() <= threshold.getTime()
          : false;
      }

      if (
        key === "ledgerJournals" &&
        typeof value === "object" &&
        value !== null &&
        "none" in value
      ) {
        const filter = (value as { none?: { journalType?: string } }).none;

        if (!filter || typeof filter !== "object") {
          return true;
        }

        return !this.ledgerJournals.some(
          (ledgerJournal) =>
            ledgerJournal.transactionIntentId === intent.id &&
            (!filter.journalType || filter.journalType === "deposit_settlement")
        );
      }

      if (
        key === "blockchainTransactions" &&
        typeof value === "object" &&
        value !== null &&
        "some" in value
      ) {
        const filter = (
          value as { some?: { status?: BlockchainTransactionStatus } }
        ).some;

        if (!filter || typeof filter !== "object") {
          return false;
        }

        return this.blockchainTransactions.some(
          (blockchainTransaction) =>
            blockchainTransaction.transactionIntentId === intent.id &&
            (!filter.status || blockchainTransaction.status === filter.status)
        );
      }

      return candidate === value;
    });
  }

  private sortIntents(
    intents: TransactionIntentRecord[],
    orderBy?: {
      createdAt?: "asc" | "desc";
    }
  ): TransactionIntentRecord[] {
    if (!orderBy?.createdAt) {
      return intents;
    }

    const direction = orderBy.createdAt === "asc" ? 1 : -1;

    return [...intents].sort(
      (left, right) =>
        (left.createdAt.getTime() - right.createdAt.getTime()) * direction
    );
  }

  private findUniqueTransactionIntent(args?: {
    where?: Record<string, unknown>;
  }): Record<string, unknown> | null {
    const idempotencyKey = args?.where?.idempotencyKey as string | undefined;

    if (!idempotencyKey) {
      return null;
    }

    const intent = this.transactionIntents.find(
      (transactionIntent) =>
        transactionIntent.idempotencyKey === idempotencyKey
    );

    return intent ? this.decorateIntent(intent) : null;
  }

  private findFirstTransactionIntent(
    args?: TransactionIntentFindArgs
  ): Record<string, unknown> | null {
    const intent = this.sortIntents(
      this.transactionIntents.filter((candidate) =>
        this.matchesIntentWhere(candidate, args?.where)
      ),
      args?.orderBy
    )[0];

    return intent ? this.decorateIntent(intent) : null;
  }

  private findManyTransactionIntents(
    args?: TransactionIntentFindArgs
  ): Record<string, unknown>[] {
    const intents = this.sortIntents(
      this.transactionIntents.filter((candidate) =>
        this.matchesIntentWhere(candidate, args?.where)
      ),
      args?.orderBy
    );
    const limitedIntents =
      typeof args?.take === "number" ? intents.slice(0, args.take) : intents;

    return limitedIntents.map((intent) => this.decorateIntent(intent));
  }

  private createTransactionIntent(
    data: Record<string, unknown>
  ): Record<string, unknown> {
    this.intentSequence += 1;
    const createdAt = this.nextTimestamp();
    const intent: TransactionIntentRecord = {
      id: this.nextId("intent", this.intentSequence),
      customerAccountId: data.customerAccountId as string,
      assetId: data.assetId as string,
      sourceWalletId: (data.sourceWalletId as string | null) ?? null,
      destinationWalletId:
        (data.destinationWalletId as string | null) ?? null,
      externalAddress: (data.externalAddress as string | null) ?? null,
      chainId: data.chainId as number,
      intentType: data.intentType as TransactionIntentType,
      status: data.status as TransactionIntentStatus,
      policyDecision: data.policyDecision as PolicyDecision,
      requestedAmount: new Prisma.Decimal(
        (data.requestedAmount as Prisma.Decimal).toString()
      ),
      settledAmount: data.settledAmount
        ? new Prisma.Decimal((data.settledAmount as Prisma.Decimal).toString())
        : null,
      idempotencyKey: data.idempotencyKey as string,
      failureCode: (data.failureCode as string | null) ?? null,
      failureReason: (data.failureReason as string | null) ?? null,
      manualInterventionRequiredAt:
        (data.manualInterventionRequiredAt as Date | null) ?? null,
      manualInterventionReviewCaseId:
        (data.manualInterventionReviewCaseId as string | null) ?? null,
      executionClaimedAt: (data.executionClaimedAt as Date | null) ?? null,
      executionClaimedByWorkerId:
        (data.executionClaimedByWorkerId as string | null) ?? null,
      createdAt,
      updatedAt: createdAt
    };

    this.transactionIntents.push(intent);
    return this.decorateIntent(intent);
  }

  private updateTransactionIntent(
    intentId: string,
    data: TransactionIntentMutationData
  ): Record<string, unknown> {
    const intent = this.transactionIntents.find(
      (transactionIntent) => transactionIntent.id === intentId
    );

    if (!intent) {
      throw new Error(`Unknown transaction intent: ${intentId}`);
    }

    if ("status" in data && typeof data.status !== "undefined") {
      intent.status = data.status;
    }

    if (
      "policyDecision" in data &&
      typeof data.policyDecision !== "undefined"
    ) {
      intent.policyDecision = data.policyDecision;
    }

    if ("failureCode" in data) {
      intent.failureCode = data.failureCode ?? null;
    }

    if ("failureReason" in data) {
      intent.failureReason = data.failureReason ?? null;
    }

    if ("manualInterventionRequiredAt" in data) {
      intent.manualInterventionRequiredAt = data.manualInterventionRequiredAt ?? null;
    }

    if ("manualInterventionReviewCaseId" in data) {
      intent.manualInterventionReviewCaseId =
        data.manualInterventionReviewCaseId ?? null;
    }

    if ("executionClaimedAt" in data) {
      intent.executionClaimedAt = data.executionClaimedAt ?? null;
    }

    if ("executionClaimedByWorkerId" in data) {
      intent.executionClaimedByWorkerId =
        data.executionClaimedByWorkerId ?? null;
    }

    if ("settledAmount" in data) {
      intent.settledAmount = data.settledAmount
        ? new Prisma.Decimal(data.settledAmount.toString())
        : null;
    }

    intent.updatedAt = this.nextTimestamp();

    return this.decorateIntent(intent);
  }

  private updateManyTransactionIntents(
    where: Record<string, unknown> | undefined,
    data: TransactionIntentMutationData
  ): { count: number } {
    const matchingIntents = this.transactionIntents.filter((intent) =>
      this.matchesIntentWhere(intent, where)
    );

    for (const intent of matchingIntents) {
      this.updateTransactionIntent(intent.id, data);
    }

    return {
      count: matchingIntents.length
    };
  }

  private createBlockchainTransaction(
    data: Record<string, unknown>
  ): BlockchainTransactionRecord {
    this.blockchainSequence += 1;
    const createdAt = this.nextTimestamp();
    const blockchainTransaction: BlockchainTransactionRecord = {
      id: this.nextId("chain_tx", this.blockchainSequence),
      transactionIntentId: data.transactionIntentId as string,
      chainId: data.chainId as number,
      txHash: (data.txHash as string | null) ?? null,
      nonce: (data.nonce as number | null) ?? null,
      serializedTransaction:
        (data.serializedTransaction as string | null) ?? null,
      status: data.status as BlockchainTransactionStatus,
      fromAddress: (data.fromAddress as string | null) ?? null,
      toAddress: (data.toAddress as string | null) ?? null,
      confirmedAt: (data.confirmedAt as Date | null) ?? null,
      createdAt,
      updatedAt: createdAt
    };

    this.blockchainTransactions.push(blockchainTransaction);
    return blockchainTransaction;
  }

  private updateBlockchainTransaction(
    blockchainTransactionId: string,
    data: Partial<BlockchainTransactionRecord>
  ): BlockchainTransactionRecord {
    const blockchainTransaction = this.blockchainTransactions.find(
      (candidate) => candidate.id === blockchainTransactionId
    );

    if (!blockchainTransaction) {
      throw new Error(`Unknown blockchain transaction: ${blockchainTransactionId}`);
    }

    if ("txHash" in data) {
      blockchainTransaction.txHash = data.txHash ?? null;
    }

    if ("status" in data && data.status) {
      blockchainTransaction.status = data.status;
    }

    if ("nonce" in data) {
      blockchainTransaction.nonce = data.nonce ?? null;
    }

    if ("serializedTransaction" in data) {
      blockchainTransaction.serializedTransaction =
        data.serializedTransaction ?? null;
    }

    if ("fromAddress" in data) {
      blockchainTransaction.fromAddress = data.fromAddress ?? null;
    }

    if ("toAddress" in data) {
      blockchainTransaction.toAddress = data.toAddress ?? null;
    }

    if ("confirmedAt" in data) {
      blockchainTransaction.confirmedAt = data.confirmedAt ?? null;
    }

    blockchainTransaction.updatedAt = this.nextTimestamp();

    return blockchainTransaction;
  }

  private createAuditEvent(data: Record<string, unknown>): AuditEventRecord {
    this.auditSequence += 1;
    const auditEvent: AuditEventRecord = {
      id: this.nextId("audit", this.auditSequence),
      action: data.action as string,
      actorType: data.actorType as string,
      actorId: data.actorId as string,
      targetId: data.targetId as string,
      metadata: (data.metadata as Record<string, unknown> | null) ?? null,
      createdAt: this.nextTimestamp()
    };

    this.auditEvents.push(auditEvent);
    return auditEvent;
  }

  private findDepositSettlementProof(args?: {
    where?: Record<string, unknown>;
  }): DepositSettlementProofRecord | null {
    const transactionIntentId = args?.where?.transactionIntentId as
      | string
      | undefined;
    const chainIdTxHash = args?.where?.chainId_txHash as
      | { chainId?: number; txHash?: string }
      | undefined;

    if (transactionIntentId) {
      return (
        this.depositSettlementProofs.find(
          (proof) => proof.transactionIntentId === transactionIntentId
        ) ?? null
      );
    }

    if (chainIdTxHash?.chainId && chainIdTxHash.txHash) {
      return (
        this.depositSettlementProofs.find(
          (proof) =>
            proof.chainId === chainIdTxHash.chainId &&
            proof.txHash === chainIdTxHash.txHash
        ) ?? null
      );
    }

    return null;
  }

  private findLedgerJournal(args?: {
    where?: Record<string, unknown>;
  }): LedgerJournalRecord | null {
    const transactionIntentId =
      (args?.where?.transactionIntentId as string | undefined) ??
      (
        args?.where?.transactionIntentId_journalType as
          | { transactionIntentId?: string }
          | undefined
      )?.transactionIntentId;

    if (!transactionIntentId) {
      return null;
    }

    return (
      this.ledgerJournals.find(
        (ledgerJournal) =>
          ledgerJournal.transactionIntentId === transactionIntentId
      ) ?? null
    );
  }

  private findReviewCase(args?: {
    where?: Record<string, unknown>;
  }): ReviewCaseRecord | null {
    const reviewCaseId = args?.where?.id as string | undefined;

    if (!reviewCaseId) {
      return null;
    }

    const existingReviewCase = this.reviewCases.find(
      (reviewCase) => reviewCase.id === reviewCaseId
    );

    if (existingReviewCase) {
      return {
        ...existingReviewCase
      };
    }

    const linkedIntent = this.transactionIntents.find(
      (intent) => intent.manualInterventionReviewCaseId === reviewCaseId
    );

    if (!linkedIntent) {
      return null;
    }

    const reviewCase: ReviewCaseRecord = {
      id: reviewCaseId,
      customerId: this.customer.id,
      customerAccountId: this.customerAccount.id,
      transactionIntentId: linkedIntent.id,
      type: "manual_intervention",
      status: "open",
      assignedOperatorId: null,
      notes: null,
      resolvedAt: null
    };

    this.reviewCases.push(reviewCase);

    return {
      ...reviewCase
    };
  }

  private createDepositSettlementProof(
    data: Record<string, unknown>
  ): DepositSettlementProofRecord {
    const proof: DepositSettlementProofRecord = {
      id: this.nextId(
        "deposit_settlement_proof",
        this.depositSettlementProofs.length + 1
      ),
      transactionIntentId: data.transactionIntentId as string,
      blockchainTransactionId: data.blockchainTransactionId as string,
      ledgerJournalId: data.ledgerJournalId as string,
      assetId: data.assetId as string,
      chainId: data.chainId as number,
      txHash: data.txHash as string,
      fromAddress: data.fromAddress as string,
      toAddress: data.toAddress as string,
      settledAmount: new Prisma.Decimal(
        (data.settledAmount as Prisma.Decimal).toString()
      ),
      confirmedAt: data.confirmedAt as Date,
      createdAt: this.nextTimestamp()
    };

    this.depositSettlementProofs.push(proof);
    return {
      ...proof
    };
  }

  private updateReviewCase(
    reviewCaseId: string,
    data: Record<string, unknown>
  ): ReviewCaseRecord {
    const reviewCase = this.reviewCases.find(
      (candidate) => candidate.id === reviewCaseId
    );

    if (!reviewCase) {
      throw new Error(`Unknown review case: ${reviewCaseId}`);
    }

    if ("status" in data) {
      reviewCase.status = data.status as string;
    }

    if ("assignedOperatorId" in data) {
      reviewCase.assignedOperatorId =
        (data.assignedOperatorId as string | null) ?? null;
    }

    if ("notes" in data) {
      reviewCase.notes = (data.notes as string | null) ?? null;
    }

    if ("resolvedAt" in data) {
      reviewCase.resolvedAt = (data.resolvedAt as Date | null) ?? null;
    }

    return {
      ...reviewCase
    };
  }

  private reserveWithdrawalBalance(args: {
    customerAccountId: string;
    assetId: string;
    amount: Prisma.Decimal;
  }): {
    availableBalance: string;
    pendingBalance: string;
  } {
    const balance = this.getOrCreateBalance();

    if (balance.available.lessThan(args.amount)) {
      throw new Error("Insufficient available balance in integration harness.");
    }

    balance.available = balance.available.minus(args.amount);
    balance.pending = balance.pending.plus(args.amount);

    return {
      availableBalance: balance.available.toString(),
      pendingBalance: balance.pending.toString()
    };
  }

  private releaseWithdrawalReservation(args: {
    customerAccountId: string;
    assetId: string;
    amount: Prisma.Decimal;
  }): {
    availableBalance: string;
    pendingBalance: string;
  } {
    const balance = this.getOrCreateBalance();

    balance.available = balance.available.plus(args.amount);
    balance.pending = balance.pending.minus(args.amount);

    return {
      availableBalance: balance.available.toString(),
      pendingBalance: balance.pending.toString()
    };
  }

  private settleConfirmedDeposit(args: {
    transactionIntentId: string;
    customerAccountId: string;
    assetId: string;
    amount: Prisma.Decimal;
  }): {
    ledgerJournalId: string;
    debitLedgerAccountId: string;
    creditLedgerAccountId: string;
    availableBalance: string;
  } {
    const existingLedgerJournal = this.ledgerJournals.find(
      (ledgerJournal) =>
        ledgerJournal.transactionIntentId === args.transactionIntentId
    );

    if (existingLedgerJournal) {
      const balance = this.getOrCreateBalance();

      return {
        ledgerJournalId: existingLedgerJournal.id,
        debitLedgerAccountId: "ledger_cash_in_transit",
        creditLedgerAccountId: "ledger_customer_available",
        availableBalance: balance.available.toString()
      };
    }

    this.journalSequence += 1;
    const ledgerJournalId = this.nextId("ledger_journal", this.journalSequence);
    this.ledgerJournals.push({
      id: ledgerJournalId,
      transactionIntentId: args.transactionIntentId,
      createdAt: this.nextTimestamp()
    });

    const balance = this.getOrCreateBalance();
    balance.available = balance.available.plus(args.amount);

    return {
      ledgerJournalId,
      debitLedgerAccountId: "ledger_cash_in_transit",
      creditLedgerAccountId: "ledger_customer_available",
      availableBalance: balance.available.toString()
    };
  }

  private settleConfirmedWithdrawal(args: {
    transactionIntentId: string;
    customerAccountId: string;
    assetId: string;
    amount: Prisma.Decimal;
  }): {
    ledgerJournalId: string;
    debitLedgerAccountId: string;
    creditLedgerAccountId: string;
    availableBalance: string;
    pendingBalance: string;
  } {
    const existingLedgerJournal = this.ledgerJournals.find(
      (ledgerJournal) =>
        ledgerJournal.transactionIntentId === args.transactionIntentId
    );
    const balance = this.getOrCreateBalance();

    if (existingLedgerJournal) {
      return {
        ledgerJournalId: existingLedgerJournal.id,
        debitLedgerAccountId: "ledger_customer_pending_withdrawal",
        creditLedgerAccountId: "ledger_treasury_settlement",
        availableBalance: balance.available.toString(),
        pendingBalance: balance.pending.toString()
      };
    }

    this.journalSequence += 1;
    const ledgerJournalId = this.nextId("ledger_journal", this.journalSequence);
    this.ledgerJournals.push({
      id: ledgerJournalId,
      transactionIntentId: args.transactionIntentId,
      createdAt: this.nextTimestamp()
    });

    balance.pending = balance.pending.minus(args.amount);

    return {
      ledgerJournalId,
      debitLedgerAccountId: "ledger_customer_pending_withdrawal",
      creditLedgerAccountId: "ledger_treasury_settlement",
      availableBalance: balance.available.toString(),
      pendingBalance: balance.pending.toString()
    };
  }
}
