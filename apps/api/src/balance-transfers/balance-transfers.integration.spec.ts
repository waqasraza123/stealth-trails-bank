jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalBalanceTransferPolicyRuntimeConfig: () => ({
    reviewThresholds: [
      {
        assetSymbol: "USDC",
        maxImmediateSettlementAmount: "100",
      },
    ],
  }),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453,
  }),
  loadSensitiveOperatorActionPolicyRuntimeConfig: () => ({
    transactionIntentDecisionAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager",
    ],
  }),
}));

import type { INestApplication } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  AssetStatus,
  PolicyDecision,
  Prisma,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType,
} from "@prisma/client";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { OperatorIdentityService } from "../auth/operator-identity.service";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { BalanceTransferEmailDeliveryService } from "./balance-transfer-email-delivery.service";
import { BalanceTransfersController } from "./balance-transfers.controller";
import { BalanceTransfersInternalController } from "./balance-transfers-internal.controller";
import { BalanceTransfersService } from "./balance-transfers.service";
import { TransactionHistoryController } from "../transaction-intents/transaction-history.controller";
import { TransactionOperationsController } from "../transaction-intents/transaction-operations.controller";
import { TransactionOperationsService } from "../transaction-intents/transaction-operations.service";

type CustomerState = {
  id: string;
  supabaseUserId: string;
  email: string;
  firstName: string;
  lastName: string;
};

type CustomerAccountState = {
  id: string;
  customerId: string;
  status: AccountLifecycleStatus;
};

type AssetState = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  status: AssetStatus;
};

type IntentState = {
  id: string;
  customerAccountId: string | null;
  recipientCustomerAccountId: string | null;
  assetId: string;
  sourceWalletId: string | null;
  destinationWalletId: string | null;
  externalAddress: string | null;
  recipientEmailSnapshot: string | null;
  recipientMaskedEmail: string | null;
  recipientMaskedDisplay: string | null;
  chainId: number;
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: Prisma.Decimal;
  settledAmount: Prisma.Decimal | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReviewCaseState = {
  id: string;
  customerId: string | null;
  customerAccountId: string | null;
  transactionIntentId: string | null;
  type: ReviewCaseType;
  status: ReviewCaseStatus;
  reasonCode: string | null;
  notes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReviewCaseEventState = {
  id: string;
  reviewCaseId: string;
  actorType: string;
  actorId: string | null;
  eventType: ReviewCaseEventType;
  note: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type AuditEventState = {
  id: string;
  customerId: string | null;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type BalanceState = {
  available: Prisma.Decimal;
  pending: Prisma.Decimal;
};

class BalanceTransferIntegrationHarness {
  readonly senderCustomer: CustomerState = {
    id: "customer_sender_1",
    supabaseUserId: "supabase_sender_1",
    email: "ada.sender@example.com",
    firstName: "Ada",
    lastName: "Sender",
  };

  readonly recipientCustomer: CustomerState = {
    id: "customer_recipient_1",
    supabaseUserId: "supabase_recipient_1",
    email: "bob.recipient@example.com",
    firstName: "Bob",
    lastName: "Recipient",
  };

  readonly senderAccount: CustomerAccountState = {
    id: "account_sender_1",
    customerId: this.senderCustomer.id,
    status: AccountLifecycleStatus.active,
  };

  readonly recipientAccount: CustomerAccountState = {
    id: "account_recipient_1",
    customerId: this.recipientCustomer.id,
    status: AccountLifecycleStatus.active,
  };

  readonly asset: AssetState = {
    id: "asset_usdc_1",
    symbol: "USDC",
    displayName: "USD Coin",
    decimals: 6,
    chainId: 8453,
    status: AssetStatus.active,
  };

  readonly authService = {
    validateToken: jest.fn(async (token: string) => {
      if (token === "sender-token") {
        return {
          id: this.senderCustomer.supabaseUserId,
          sessionId: "session_sender_1",
        };
      }

      if (token === "recipient-token") {
        return {
          id: this.recipientCustomer.supabaseUserId,
          sessionId: "session_recipient_1",
        };
      }

      throw new Error("Invalid test token.");
    }),
    assertCustomerMoneyMovementEnabled: jest.fn().mockResolvedValue(undefined),
    assertCustomerStepUpFresh: jest.fn().mockResolvedValue(undefined),
  };

  readonly operatorIdentityService = {
    resolveFromBearerToken: jest.fn(
      async ({
        headers,
      }: {
        headers: Record<string, string | string[] | undefined>;
      }) => {
        if (headers.authorization !== "Bearer ops-admin-token") {
          return null;
        }

        return {
          operatorDbId: null,
          operatorId: "ops_1",
          operatorRole: "operations_admin",
          operatorRoles: ["operations_admin"],
          operatorSupabaseUserId: null,
          operatorEmail: "ops@example.com",
          authSource: "supabase_jwt" as const,
          environment: "development" as const,
          sessionCorrelationId: null,
        };
      }
    ),
    resolveFromLegacyApiKey: jest.fn(async () => null),
  };

  readonly emailDeliveryService = {
    sendTransferEmail: jest.fn().mockResolvedValue(undefined),
  };

  readonly notificationsService = {
    publishAuditEventRecord: jest.fn().mockResolvedValue(undefined),
  };

  readonly prismaService: PrismaService;

  readonly ledgerService: LedgerService;

  private readonly balances = new Map<string, BalanceState>([
    [
      this.senderAccount.id,
      {
        available: new Prisma.Decimal("500"),
        pending: new Prisma.Decimal("0"),
      },
    ],
    [
      this.recipientAccount.id,
      {
        available: new Prisma.Decimal("40"),
        pending: new Prisma.Decimal("0"),
      },
    ],
  ]);

  private readonly intents: IntentState[] = [];
  private readonly reviewCases: ReviewCaseState[] = [];
  private readonly reviewCaseEvents: ReviewCaseEventState[] = [];
  private readonly auditEvents: AuditEventState[] = [];
  private sequence = 1;

  constructor() {
    const prismaTransaction = {
      transactionIntent: {
        create: jest.fn(
          async ({
            data,
          }: {
            data: Omit<IntentState, "id" | "createdAt" | "updatedAt">;
          }) => {
            const createdAt = this.nextDate();
            const intent: IntentState = {
              id: `intent_${this.intents.length + 1}`,
              customerAccountId: data.customerAccountId,
              recipientCustomerAccountId: data.recipientCustomerAccountId,
              assetId: data.assetId,
              sourceWalletId: data.sourceWalletId,
              destinationWalletId: data.destinationWalletId,
              externalAddress: data.externalAddress,
              recipientEmailSnapshot: data.recipientEmailSnapshot,
              recipientMaskedEmail: data.recipientMaskedEmail,
              recipientMaskedDisplay: data.recipientMaskedDisplay,
              chainId: data.chainId,
              intentType: data.intentType,
              status: data.status,
              policyDecision: data.policyDecision,
              requestedAmount: new Prisma.Decimal(data.requestedAmount),
              settledAmount: data.settledAmount
                ? new Prisma.Decimal(data.settledAmount)
                : null,
              idempotencyKey: data.idempotencyKey,
              failureCode: data.failureCode,
              failureReason: data.failureReason,
              createdAt,
              updatedAt: createdAt,
            };

            this.intents.push(intent);
            return this.hydrateIntent(intent.id);
          }
        ),
        findFirstOrThrow: jest.fn(
          async ({ where }: { where: { id: string } }) => {
            const hydrated = this.hydrateIntent(where.id);

            if (!hydrated) {
              throw new Error(`Intent ${where.id} not found.`);
            }

            return hydrated;
          }
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<IntentState>;
          }) => {
            const intent = this.requireIntent(where.id);
            Object.assign(intent, data, {
              updatedAt: this.nextDate(),
            });
            return this.hydrateIntent(intent.id);
          }
        ),
      },
      reviewCase: {
        create: jest.fn(
          async ({
            data,
          }: {
            data: Omit<
              ReviewCaseState,
              "id" | "createdAt" | "updatedAt" | "resolvedAt"
            > & {
              resolvedAt?: Date | null;
            };
          }) => {
            const createdAt = this.nextDate();
            const reviewCase: ReviewCaseState = {
              id: `review_case_${this.reviewCases.length + 1}`,
              customerId: data.customerId,
              customerAccountId: data.customerAccountId,
              transactionIntentId: data.transactionIntentId,
              type: data.type,
              status: data.status,
              reasonCode: data.reasonCode,
              notes: data.notes,
              resolvedAt: data.resolvedAt ?? null,
              createdAt,
              updatedAt: createdAt,
            };

            this.reviewCases.push(reviewCase);
            return reviewCase;
          }
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<ReviewCaseState>;
          }) => {
            const reviewCase = this.requireReviewCase(where.id);
            Object.assign(reviewCase, data, {
              updatedAt: this.nextDate(),
            });
            return reviewCase;
          }
        ),
      },
      reviewCaseEvent: {
        create: jest.fn(
          async ({
            data,
          }: {
            data: Omit<ReviewCaseEventState, "id" | "createdAt">;
          }) => {
            const event: ReviewCaseEventState = {
              id: `review_case_event_${this.reviewCaseEvents.length + 1}`,
              reviewCaseId: data.reviewCaseId,
              actorType: data.actorType,
              actorId: data.actorId,
              eventType: data.eventType,
              note: data.note,
              metadata: data.metadata,
              createdAt: this.nextDate(),
            };

            this.reviewCaseEvents.push(event);
            return event;
          }
        ),
      },
      auditEvent: {
        create: jest.fn(
          async ({
            data,
          }: {
            data: Omit<AuditEventState, "id" | "createdAt">;
          }) => {
            const event: AuditEventState = {
              id: `audit_${this.auditEvents.length + 1}`,
              customerId: data.customerId,
              actorType: data.actorType,
              actorId: data.actorId,
              action: data.action,
              targetType: data.targetType,
              targetId: data.targetId,
              metadata: data.metadata,
              createdAt: this.nextDate(),
            };

            this.auditEvents.push(event);
            return event;
          }
        ),
      },
    };

    this.prismaService = {
      customerAccount: {
        findFirst: jest.fn(async (args: Record<string, unknown>) =>
          this.findCustomerAccount(args)
        ),
      },
      asset: {
        findUnique: jest.fn(async (args: Record<string, unknown>) =>
          this.findAsset(args)
        ),
      },
      transactionIntent: {
        findUnique: jest.fn(async (args: Record<string, unknown>) =>
          this.findIntentUnique(args)
        ),
        findFirst: jest.fn(async (args: Record<string, unknown>) =>
          this.findIntentFirst(args)
        ),
        findMany: jest.fn(async (args: Record<string, unknown>) =>
          this.findIntentMany(args)
        ),
      },
      auditEvent: {
        findMany: jest.fn(async (args: Record<string, unknown>) =>
          this.findAuditEvents(args)
        ),
      },
      $transaction: jest.fn(
        async (
          callback: (
            tx: typeof prismaTransaction
          ) => Promise<unknown> | unknown
        ) => callback(prismaTransaction)
      ),
    } as unknown as PrismaService;

    this.ledgerService = {
      reserveInternalBalanceTransferBalance: jest.fn(
        async (
          _transaction: unknown,
          input: {
            customerAccountId: string;
            amount: Prisma.Decimal;
          }
        ) => {
          const senderBalance = this.requireBalance(input.customerAccountId);
          senderBalance.available = senderBalance.available.minus(input.amount);
          senderBalance.pending = senderBalance.pending.plus(input.amount);

          return {
            ledgerJournalId: `journal_reserve_${this.sequence}`,
            debitLedgerAccountId: "ledger_sender_available",
            creditLedgerAccountId: "ledger_sender_pending",
            senderAvailableBalance: senderBalance.available.toString(),
            senderPendingBalance: senderBalance.pending.toString(),
          };
        }
      ),
      releaseInternalBalanceTransferReservation: jest.fn(
        async (
          _transaction: unknown,
          input: {
            customerAccountId: string;
            amount: Prisma.Decimal;
          }
        ) => {
          const senderBalance = this.requireBalance(input.customerAccountId);
          senderBalance.available = senderBalance.available.plus(input.amount);
          senderBalance.pending = senderBalance.pending.minus(input.amount);

          return {
            ledgerJournalId: `journal_release_${this.sequence}`,
            debitLedgerAccountId: "ledger_sender_pending",
            creditLedgerAccountId: "ledger_sender_available",
            senderAvailableBalance: senderBalance.available.toString(),
            senderPendingBalance: senderBalance.pending.toString(),
          };
        }
      ),
      settleInternalBalanceTransfer: jest.fn(
        async (
          _transaction: unknown,
          input: {
            senderCustomerAccountId: string;
            recipientCustomerAccountId: string;
            amount: Prisma.Decimal;
            settleFromPending: boolean;
          }
        ) => {
          const senderBalance = this.requireBalance(input.senderCustomerAccountId);
          const recipientBalance = this.requireBalance(
            input.recipientCustomerAccountId
          );

          if (input.settleFromPending) {
            senderBalance.pending = senderBalance.pending.minus(input.amount);
          } else {
            senderBalance.available = senderBalance.available.minus(input.amount);
          }

          recipientBalance.available =
            recipientBalance.available.plus(input.amount);

          return {
            ledgerJournalId: `journal_settle_${this.sequence}`,
            debitLedgerAccountId: input.settleFromPending
              ? "ledger_sender_pending"
              : "ledger_sender_available",
            creditLedgerAccountId: "ledger_recipient_available",
            senderAvailableBalance: senderBalance.available.toString(),
            senderPendingBalance: senderBalance.pending.toString(),
            recipientAvailableBalance: recipientBalance.available.toString(),
            recipientPendingBalance: recipientBalance.pending.toString(),
          };
        }
      ),
    } as unknown as LedgerService;
  }

  get senderHeaders() {
    return {
      Authorization: "Bearer sender-token",
    };
  }

  get recipientHeaders() {
    return {
      Authorization: "Bearer recipient-token",
    };
  }

  get operatorHeaders() {
    return {
      Authorization: "Bearer ops-admin-token",
    };
  }

  getBalanceSnapshot(customerAccountId: string) {
    const balance = this.requireBalance(customerAccountId);

    return {
      available: balance.available.toString(),
      pending: balance.pending.toString(),
    };
  }

  private nextDate(): Date {
    const value = new Date(
      Date.parse("2026-04-22T12:00:00.000Z") + this.sequence * 1000
    );
    this.sequence += 1;
    return value;
  }

  private requireBalance(customerAccountId: string): BalanceState {
    const balance = this.balances.get(customerAccountId);

    if (!balance) {
      throw new Error(`Balance for ${customerAccountId} was not found.`);
    }

    return balance;
  }

  private requireIntent(intentId: string): IntentState {
    const intent = this.intents.find((item) => item.id === intentId);

    if (!intent) {
      throw new Error(`Intent ${intentId} was not found.`);
    }

    return intent;
  }

  private requireReviewCase(reviewCaseId: string): ReviewCaseState {
    const reviewCase = this.reviewCases.find((item) => item.id === reviewCaseId);

    if (!reviewCase) {
      throw new Error(`Review case ${reviewCaseId} was not found.`);
    }

    return reviewCase;
  }

  private findCustomerBySupabaseUserId(
    supabaseUserId: string
  ): CustomerState | null {
    if (supabaseUserId === this.senderCustomer.supabaseUserId) {
      return this.senderCustomer;
    }

    if (supabaseUserId === this.recipientCustomer.supabaseUserId) {
      return this.recipientCustomer;
    }

    return null;
  }

  private findCustomerByEmail(email: string): CustomerState | null {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === this.senderCustomer.email) {
      return this.senderCustomer;
    }

    if (normalizedEmail === this.recipientCustomer.email) {
      return this.recipientCustomer;
    }

    return null;
  }

  private findAccountByCustomerId(
    customerId: string
  ): CustomerAccountState | null {
    if (customerId === this.senderAccount.customerId) {
      return this.senderAccount;
    }

    if (customerId === this.recipientAccount.customerId) {
      return this.recipientAccount;
    }

    return null;
  }

  private buildCustomerAccountRecord(account: CustomerAccountState) {
    const customer =
      account.customerId === this.senderCustomer.id
        ? this.senderCustomer
        : this.recipientCustomer;

    return {
      id: account.id,
      customerId: account.customerId,
      status: account.status,
      customer: {
        id: customer.id,
        supabaseUserId: customer.supabaseUserId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    };
  }

  private hydrateIntent(intentId: string) {
    const intent = this.intents.find((item) => item.id === intentId);

    if (!intent) {
      return null;
    }

    const senderAccount = intent.customerAccountId
      ? this.buildCustomerAccountRecord(this.requireAccount(intent.customerAccountId))
      : null;
    const recipientAccount = intent.recipientCustomerAccountId
      ? this.buildCustomerAccountRecord(
          this.requireAccount(intent.recipientCustomerAccountId)
        )
      : null;

    return {
      id: intent.id,
      customerAccountId: intent.customerAccountId,
      recipientCustomerAccountId: intent.recipientCustomerAccountId,
      assetId: intent.assetId,
      asset: {
        id: this.asset.id,
        symbol: this.asset.symbol,
        displayName: this.asset.displayName,
        decimals: this.asset.decimals,
        chainId: this.asset.chainId,
      },
      sourceWalletId: intent.sourceWalletId,
      sourceWallet: null,
      destinationWalletId: intent.destinationWalletId,
      destinationWallet: null,
      externalAddress: intent.externalAddress,
      chainId: intent.chainId,
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: new Prisma.Decimal(intent.requestedAmount),
      settledAmount: intent.settledAmount
        ? new Prisma.Decimal(intent.settledAmount)
        : null,
      idempotencyKey: intent.idempotencyKey,
      failureCode: intent.failureCode,
      failureReason: intent.failureReason,
      recipientEmailSnapshot: intent.recipientEmailSnapshot,
      recipientMaskedEmail: intent.recipientMaskedEmail,
      recipientMaskedDisplay: intent.recipientMaskedDisplay,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
      customerAccount: senderAccount,
      recipientCustomerAccount: recipientAccount,
      reviewCases: this.reviewCases
        .filter((item) => item.transactionIntentId === intent.id)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((reviewCase) => ({
          id: reviewCase.id,
          type: reviewCase.type,
          status: reviewCase.status,
          reasonCode: reviewCase.reasonCode,
          createdAt: reviewCase.createdAt,
          updatedAt: reviewCase.updatedAt,
        })),
      blockchainTransactions: [],
    };
  }

  private requireAccount(accountId: string): CustomerAccountState {
    if (accountId === this.senderAccount.id) {
      return this.senderAccount;
    }

    if (accountId === this.recipientAccount.id) {
      return this.recipientAccount;
    }

    throw new Error(`Account ${accountId} was not found.`);
  }

  private async findCustomerAccount(args: Record<string, unknown>) {
    const where = (args.where ?? {}) as {
      status?: AccountLifecycleStatus;
      customer?: {
        supabaseUserId?: string;
        email?: {
          equals?: string;
        };
      };
    };

    let customer: CustomerState | null = null;

    if (where.customer?.supabaseUserId) {
      customer = this.findCustomerBySupabaseUserId(where.customer.supabaseUserId);
    } else if (where.customer?.email?.equals) {
      customer = this.findCustomerByEmail(where.customer.email.equals);
    }

    if (!customer) {
      return null;
    }

    const account = this.findAccountByCustomerId(customer.id);

    if (!account) {
      return null;
    }

    if (where.status && account.status !== where.status) {
      return null;
    }

    return this.buildCustomerAccountRecord(account);
  }

  private async findAsset(args: Record<string, unknown>) {
    const where = (args.where ?? {}) as {
      chainId_symbol?: {
        chainId: number;
        symbol: string;
      };
    };

    if (
      where.chainId_symbol?.chainId !== this.asset.chainId ||
      where.chainId_symbol?.symbol !== this.asset.symbol
    ) {
      return null;
    }

    return {
      id: this.asset.id,
      symbol: this.asset.symbol,
      displayName: this.asset.displayName,
      decimals: this.asset.decimals,
      status: this.asset.status,
    };
  }

  private async findIntentUnique(args: Record<string, unknown>) {
    const where = (args.where ?? {}) as {
      idempotencyKey?: string;
    };

    if (!where.idempotencyKey) {
      return null;
    }

    const intent = this.intents.find(
      (item) => item.idempotencyKey === where.idempotencyKey
    );

    return intent ? this.hydrateIntent(intent.id) : null;
  }

  private async findIntentFirst(args: Record<string, unknown>) {
    const where = (args.where ?? {}) as Record<string, unknown>;
    const intent = this.intents.find((item) => this.matchesIntentWhere(item, where));

    if (!intent) {
      return null;
    }

    if (args.select && typeof args.select === "object") {
      return {
        id: intent.id,
      };
    }

    return this.hydrateIntent(intent.id);
  }

  private async findIntentMany(args: Record<string, unknown>) {
    const where = (args.where ?? {}) as Record<string, unknown>;
    const orderBy = (args.orderBy ?? {}) as {
      createdAt?: "asc" | "desc";
    };
    const take = typeof args.take === "number" ? args.take : undefined;
    const direction = orderBy.createdAt ?? "desc";

    const results = this.intents
      .filter((item) => this.matchesIntentWhere(item, where))
      .sort((left, right) =>
        direction === "asc"
          ? left.createdAt.getTime() - right.createdAt.getTime()
          : right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, take ?? this.intents.length)
      .map((item) => this.hydrateIntent(item.id));

    return results.filter(Boolean);
  }

  private async findAuditEvents(args: Record<string, unknown>) {
    const where = (args.where ?? {}) as {
      targetType?: string;
      targetId?: string;
    };
    const orderBy = (args.orderBy ?? {}) as {
      createdAt?: "asc" | "desc";
    };
    const direction = orderBy.createdAt ?? "asc";

    return this.auditEvents
      .filter(
        (event) =>
          (!where.targetType || event.targetType === where.targetType) &&
          (!where.targetId || event.targetId === where.targetId)
      )
      .sort((left, right) =>
        direction === "asc"
          ? left.createdAt.getTime() - right.createdAt.getTime()
          : right.createdAt.getTime() - left.createdAt.getTime()
      )
      .map((event) => ({
        id: event.id,
        actorType: event.actorType,
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata,
        createdAt: event.createdAt,
      }));
  }

  private matchesIntentWhere(
    intent: IntentState,
    where: Record<string, unknown> | undefined
  ): boolean {
    if (!where || Object.keys(where).length === 0) {
      return true;
    }

    const andClauses = Array.isArray(where.AND)
      ? (where.AND as Record<string, unknown>[])
      : null;

    if (andClauses && !andClauses.every((clause) => this.matchesIntentWhere(intent, clause))) {
      return false;
    }

    const orClauses = Array.isArray(where.OR)
      ? (where.OR as Record<string, unknown>[])
      : null;

    if (orClauses && !orClauses.some((clause) => this.matchesIntentWhere(intent, clause))) {
      return false;
    }

    if (
      typeof where.chainId === "number" &&
      intent.chainId !== where.chainId
    ) {
      return false;
    }

    if (
      typeof where.id === "string" &&
      intent.id !== where.id
    ) {
      return false;
    }

    if (
      typeof where.intentType === "string" &&
      intent.intentType !== where.intentType
    ) {
      return false;
    }

    if (
      typeof where.status === "string" &&
      intent.status !== where.status
    ) {
      return false;
    }

    if (
      typeof where.policyDecision === "string" &&
      intent.policyDecision !== where.policyDecision
    ) {
      return false;
    }

    if (
      typeof where.customerAccountId === "string" &&
      intent.customerAccountId !== where.customerAccountId
    ) {
      return false;
    }

    if (
      typeof where.recipientCustomerAccountId === "string" &&
      intent.recipientCustomerAccountId !== where.recipientCustomerAccountId
    ) {
      return false;
    }

    if (
      typeof where.idempotencyKey === "string" &&
      intent.idempotencyKey !== where.idempotencyKey
    ) {
      return false;
    }

    if (
      where.asset &&
      typeof where.asset === "object" &&
      "symbol" in where.asset &&
      (where.asset as { symbol?: string }).symbol !== this.asset.symbol
    ) {
      return false;
    }

    const senderAccount = intent.customerAccountId
      ? this.buildCustomerAccountRecord(this.requireAccount(intent.customerAccountId))
      : null;
    const recipientAccount = intent.recipientCustomerAccountId
      ? this.buildCustomerAccountRecord(
          this.requireAccount(intent.recipientCustomerAccountId)
        )
      : null;

    if (
      where.customerAccount &&
      typeof where.customerAccount === "object" &&
      !this.matchesAccountRelation(
        senderAccount,
        where.customerAccount as Record<string, unknown>
      )
    ) {
      return false;
    }

    if (
      where.recipientCustomerAccount &&
      typeof where.recipientCustomerAccount === "object" &&
      !this.matchesAccountRelation(
        recipientAccount,
        where.recipientCustomerAccount as Record<string, unknown>
      )
    ) {
      return false;
    }

    return true;
  }

  private matchesAccountRelation(
    account:
      | {
          id: string;
          customerId: string;
          customer: {
            supabaseUserId: string;
            email: string;
          };
        }
      | null,
    where: Record<string, unknown>
  ) {
    if (!account) {
      return false;
    }

    if (
      where.customer &&
      typeof where.customer === "object" &&
      !this.matchesCustomerRelation(
        account.customer,
        where.customer as Record<string, unknown>
      )
    ) {
      return false;
    }

    return true;
  }

  private matchesCustomerRelation(
    customer: {
      supabaseUserId: string;
      email: string;
    },
    where: Record<string, unknown>
  ) {
    if (
      typeof where.supabaseUserId === "string" &&
      customer.supabaseUserId !== where.supabaseUserId
    ) {
      return false;
    }

    if (
      typeof where.email === "string" &&
      customer.email !== where.email
    ) {
      return false;
    }

    return true;
  }
}

describe("BalanceTransfers integration", () => {
  let app: INestApplication;
  let harness: BalanceTransferIntegrationHarness;

  beforeEach(async () => {
    harness = new BalanceTransferIntegrationHarness();

    const integrationApp = await createIntegrationTestApp({
      controllers: [
        BalanceTransfersController,
        BalanceTransfersInternalController,
        TransactionHistoryController,
        TransactionOperationsController,
      ],
      providers: [
        BalanceTransfersService,
        TransactionOperationsService,
        JwtAuthGuard,
        InternalOperatorBearerGuard,
        {
          provide: AuthService,
          useValue: harness.authService,
        },
        {
          provide: OperatorIdentityService,
          useValue: harness.operatorIdentityService,
        },
        {
          provide: PrismaService,
          useValue: harness.prismaService,
        },
        {
          provide: LedgerService,
          useValue: harness.ledgerService,
        },
        {
          provide: BalanceTransferEmailDeliveryService,
          useValue: harness.emailDeliveryService,
        },
        {
          provide: NotificationsService,
          useValue: harness.notificationsService,
        },
      ],
    });

    app = integrationApp.app;
  });

  afterEach(async () => {
    await app?.close();
  });

  it("settles low-risk transfers immediately and projects sender and recipient history correctly", async () => {
    const previewResponse = await request(app.getHttpServer())
      .post("/balance-transfers/me/recipient-preview")
      .set(harness.senderHeaders)
      .send({
        email: harness.recipientCustomer.email,
        assetSymbol: "usdc",
        amount: "25",
      });

    expect(previewResponse.status).toBe(201);
    expect(previewResponse.body.data).toEqual({
      normalizedEmail: harness.recipientCustomer.email,
      available: true,
      maskedEmail: "b****t@e****.com",
      maskedDisplay: "B*** R***",
      thresholdOutcome: "settled_immediately",
    });

    const createResponse = await request(app.getHttpServer())
      .post("/balance-transfers/me")
      .set(harness.senderHeaders)
      .send({
        idempotencyKey: "balance_transfer_immediate_001",
        assetSymbol: "USDC",
        amount: "25",
        recipientEmail: harness.recipientCustomer.email,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.idempotencyReused).toBe(false);
    expect(createResponse.body.data.thresholdOutcome).toBe("settled_immediately");
    expect(createResponse.body.data.intent).toEqual(
      expect.objectContaining({
        intentType: "internal_balance_transfer",
        status: "settled",
        policyDecision: "approved",
        requestedAmount: "25",
        settledAmount: "25",
        recipientMaskedDisplay: "B*** R***",
        recipientMaskedEmail: "b****t@e****.com",
      })
    );

    const senderHistoryResponse = await request(app.getHttpServer())
      .get("/transaction-intents/me/history?limit=10")
      .set(harness.senderHeaders);

    expect(senderHistoryResponse.status).toBe(200);
    expect(senderHistoryResponse.body.data.intents).toHaveLength(1);
    expect(senderHistoryResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        intentType: "internal_balance_transfer",
        status: "settled",
        transferDirection: "sent",
        counterpartyMaskedDisplay: "B*** R***",
        counterpartyMaskedEmail: "b****t@e****.com",
      })
    );

    const recipientHistoryResponse = await request(app.getHttpServer())
      .get("/transaction-intents/me/history?limit=10")
      .set(harness.recipientHeaders);

    expect(recipientHistoryResponse.status).toBe(200);
    expect(recipientHistoryResponse.body.data.intents).toHaveLength(1);
    expect(recipientHistoryResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        intentType: "internal_balance_transfer",
        status: "settled",
        transferDirection: "received",
        counterpartyMaskedDisplay: "A*** S***",
        counterpartyMaskedEmail: "a****r@e****.com",
      })
    );

    expect(harness.getBalanceSnapshot(harness.senderAccount.id)).toEqual({
      available: "475",
      pending: "0",
    });
    expect(harness.getBalanceSnapshot(harness.recipientAccount.id)).toEqual({
      available: "65",
      pending: "0",
    });
    expect(harness.emailDeliveryService.sendTransferEmail).toHaveBeenCalledTimes(4);
    expect(
      harness.emailDeliveryService.sendTransferEmail
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "sender",
        purpose: "settled",
      })
    );
    expect(
      harness.emailDeliveryService.sendTransferEmail
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "recipient",
        purpose: "settled",
      })
    );
  });

  it("queues high-risk transfers for review, settles them on approval, and records the audit timeline", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/balance-transfers/me")
      .set(harness.senderHeaders)
      .send({
        idempotencyKey: "balance_transfer_review_approval_001",
        assetSymbol: "USDC",
        amount: "250",
        recipientEmail: harness.recipientCustomer.email,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.thresholdOutcome).toBe("review_required");
    expect(createResponse.body.data.intent.status).toBe("review_required");

    const intentId = createResponse.body.data.intent.id as string;

    const pendingResponse = await request(app.getHttpServer())
      .get("/balance-transfers/internal/pending?limit=10")
      .set(harness.operatorHeaders);

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.data.intents).toHaveLength(1);
    expect(pendingResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        id: intentId,
        status: "review_required",
        sender: expect.objectContaining({
          email: harness.senderCustomer.email,
        }),
        recipient: expect.objectContaining({
          maskedDisplay: "B*** R***",
          maskedEmail: "b****t@e****.com",
        }),
      })
    );

    const approvalResponse = await request(app.getHttpServer())
      .post(`/balance-transfers/internal/${intentId}/decision`)
      .set(harness.operatorHeaders)
      .send({
        decision: "approved",
        note: "Operations review passed.",
      });

    expect(approvalResponse.status).toBe(201);
    expect(approvalResponse.body.data.decisionReused).toBe(false);
    expect(approvalResponse.body.data.intent).toEqual(
      expect.objectContaining({
        id: intentId,
        status: "settled",
        policyDecision: "approved",
        settledAmount: "250",
      })
    );

    const emptyPendingResponse = await request(app.getHttpServer())
      .get("/balance-transfers/internal/pending?limit=10")
      .set(harness.operatorHeaders);

    expect(emptyPendingResponse.status).toBe(200);
    expect(emptyPendingResponse.body.data.intents).toHaveLength(0);

    const recipientHistoryResponse = await request(app.getHttpServer())
      .get("/transaction-intents/me/history?limit=10")
      .set(harness.recipientHeaders);

    expect(recipientHistoryResponse.status).toBe(200);
    expect(recipientHistoryResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        id: intentId,
        status: "settled",
        policyDecision: "approved",
        transferDirection: "received",
        counterpartyMaskedDisplay: "A*** S***",
        counterpartyMaskedEmail: "a****r@e****.com",
      })
    );

    const auditTimelineResponse = await request(app.getHttpServer())
      .get(`/transaction-intents/internal/operations/${intentId}/audit-events`)
      .set(harness.operatorHeaders);

    expect(auditTimelineResponse.status).toBe(200);
    expect(
      auditTimelineResponse.body.data.auditEvents.map(
        (event: { action: string }) => event.action
      )
    ).toEqual([
      "transaction_intent.internal_balance_transfer.review_required",
      "transaction_intent.internal_balance_transfer.approved",
    ]);

    expect(harness.getBalanceSnapshot(harness.senderAccount.id)).toEqual({
      available: "250",
      pending: "0",
    });
    expect(harness.getBalanceSnapshot(harness.recipientAccount.id)).toEqual({
      available: "290",
      pending: "0",
    });
    expect(harness.emailDeliveryService.sendTransferEmail).toHaveBeenCalledTimes(6);
  });

  it("releases held funds and removes denied transfers from the pending queue", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/balance-transfers/me")
      .set(harness.senderHeaders)
      .send({
        idempotencyKey: "balance_transfer_review_denial_001",
        assetSymbol: "USDC",
        amount: "175",
        recipientEmail: harness.recipientCustomer.email,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.intent.status).toBe("review_required");

    const intentId = createResponse.body.data.intent.id as string;

    const denialResponse = await request(app.getHttpServer())
      .post(`/balance-transfers/internal/${intentId}/decision`)
      .set(harness.operatorHeaders)
      .send({
        decision: "denied",
        note: "Manual review rejected.",
        denialReason: "Recipient mismatch",
      });

    expect(denialResponse.status).toBe(201);
    expect(denialResponse.body.data.intent).toEqual(
      expect.objectContaining({
        id: intentId,
        status: "cancelled",
        policyDecision: "denied",
        failureCode: "policy_denied",
        failureReason: "Recipient mismatch",
      })
    );

    const senderHistoryResponse = await request(app.getHttpServer())
      .get("/transaction-intents/me/history?limit=10")
      .set(harness.senderHeaders);

    expect(senderHistoryResponse.status).toBe(200);
    expect(senderHistoryResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        id: intentId,
        status: "cancelled",
        policyDecision: "denied",
        transferDirection: "sent",
      })
    );

    const pendingResponse = await request(app.getHttpServer())
      .get("/balance-transfers/internal/pending?limit=10")
      .set(harness.operatorHeaders);

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.data.intents).toHaveLength(0);

    const auditTimelineResponse = await request(app.getHttpServer())
      .get(`/transaction-intents/internal/operations/${intentId}/audit-events`)
      .set(harness.operatorHeaders);

    expect(auditTimelineResponse.status).toBe(200);
    expect(
      auditTimelineResponse.body.data.auditEvents.map(
        (event: { action: string }) => event.action
      )
    ).toEqual([
      "transaction_intent.internal_balance_transfer.review_required",
      "transaction_intent.internal_balance_transfer.denied",
    ]);

    expect(harness.getBalanceSnapshot(harness.senderAccount.id)).toEqual({
      available: "500",
      pending: "0",
    });
    expect(harness.getBalanceSnapshot(harness.recipientAccount.id)).toEqual({
      available: "40",
      pending: "0",
    });
    expect(
      harness.emailDeliveryService.sendTransferEmail
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "sender",
        purpose: "denied",
        note: "Recipient mismatch",
      })
    );
  });
});
