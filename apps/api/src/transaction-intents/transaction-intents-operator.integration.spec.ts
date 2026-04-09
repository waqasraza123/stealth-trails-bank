jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  }),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { TransactionIntentsInternalController } from "./transaction-intents-internal.controller";
import { TransactionIntentsService } from "./transaction-intents.service";

function buildReviewIntentRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "intent_1",
    customerAccountId: "account_1",
    asset: {
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    sourceWalletId: null,
    destinationWalletId: "wallet_1",
    destinationWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000abc"
    },
    externalAddress: null,
    chainId: 8453,
    intentType: "deposit",
    status: "requested",
    policyDecision: "pending",
    requestedAmount: new Prisma.Decimal("125.50"),
    settledAmount: null,
    idempotencyKey: "deposit-intent-001",
    failureCode: null,
    failureReason: null,
    createdAt: new Date("2026-04-06T18:00:00.000Z"),
    updatedAt: new Date("2026-04-06T18:00:00.000Z"),
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace"
      }
    },
    blockchainTransactions: [],
    ...overrides
  };
}

describe("TransactionIntentsInternalController integration", () => {
  let app: INestApplication;
  let currentIntent: ReturnType<typeof buildReviewIntentRecord>;

  const prismaTransaction = {
    transactionIntent: {
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        currentIntent = buildReviewIntentRecord({
          ...currentIntent,
          ...data,
          updatedAt: new Date("2026-04-06T18:05:00.000Z")
        });

        return currentIntent;
      }),
      findFirst: jest.fn(async () => currentIntent)
    },
    blockchainTransaction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        currentIntent = buildReviewIntentRecord({
          ...currentIntent,
          blockchainTransactions: [
            {
              id: "tx_1",
              txHash: data.txHash,
              status: data.status,
              fromAddress: data.fromAddress,
              toAddress: data.toAddress,
              createdAt: new Date("2026-04-06T18:05:00.000Z"),
              updatedAt: new Date("2026-04-06T18:05:00.000Z"),
              confirmedAt: null
            }
          ]
        });

        return {
          id: "tx_1"
        };
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const latestBlockchainTransaction =
          currentIntent.blockchainTransactions[0] as Record<string, unknown> | undefined;

        currentIntent = buildReviewIntentRecord({
          ...currentIntent,
          blockchainTransactions: latestBlockchainTransaction
            ? [
                {
                  ...latestBlockchainTransaction,
                  ...data,
                  updatedAt: new Date("2026-04-06T18:05:00.000Z")
                }
              ]
            : currentIntent.blockchainTransactions
        });

        return {
          id: "tx_1"
        };
      })
    },
    auditEvent: {
      create: jest.fn(async () => ({
        id: "audit_1"
      }))
    }
  };

  const prismaService = {
    transactionIntent: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (
          where.status === currentIntent.status &&
          where.policyDecision === currentIntent.policyDecision
        ) {
          return [currentIntent];
        }

        return [];
      }),
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === currentIntent.id) {
          return currentIntent;
        }

        return null;
      })
    },
    $transaction: jest.fn(async (callback: (tx: typeof prismaTransaction) => unknown) =>
      callback(prismaTransaction)
    )
  };

  beforeAll(async () => {
    const integrationApp = await createIntegrationTestApp({
      controllers: [TransactionIntentsInternalController],
      providers: [
        TransactionIntentsService,
        InternalOperatorApiKeyGuard,
        {
          provide: PrismaService,
          useValue: prismaService
        },
        {
          provide: LedgerService,
          useValue: {}
        }
      ]
    });

    app = integrationApp.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentIntent = buildReviewIntentRecord();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects pending review access without the internal operator key", async () => {
    const response = await request(app.getHttpServer()).get(
      "/transaction-intents/internal/deposit-requests/pending"
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Missing operator API key.");
  });

  it("lists pending deposit intents over the guarded internal operator API", async () => {
    const response = await request(app.getHttpServer())
      .get("/transaction-intents/internal/deposit-requests/pending?limit=10")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data.limit).toBe(10);
    expect(response.body.data.intents).toHaveLength(1);
    expect(response.body.data.intents[0].status).toBe("requested");
    expect(response.body.data.intents[0].customer.email).toBe("ada@example.com");
  });

  it("approves a pending deposit intent and records operator audit metadata", async () => {
    const response = await request(app.getHttpServer())
      .post("/transaction-intents/internal/deposit-requests/intent_1/decision")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        decision: "approved",
        note: "Risk review complete."
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Deposit request approved successfully.");
    expect(response.body.data.decision).toBe("approved");
    expect(response.body.data.intent.status).toBe("approved");
    expect(response.body.data.intent.policyDecision).toBe("approved");
    expect(prismaTransaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "operator",
          actorId: "ops_1",
          action: "transaction_intent.deposit.approved"
        })
      })
    );
  });

  it("queues an approved deposit intent and reuses queue state on duplicate requests", async () => {
    currentIntent = buildReviewIntentRecord({
      status: "approved",
      policyDecision: "approved",
      updatedAt: new Date("2026-04-06T18:03:00.000Z")
    });

    const firstResponse = await request(app.getHttpServer())
      .post("/transaction-intents/internal/deposit-requests/intent_1/queue")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        note: "Ready for worker pickup."
      });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.message).toBe("Deposit request queued successfully.");
    expect(firstResponse.body.data.queueReused).toBe(false);
    expect(firstResponse.body.data.intent.status).toBe("queued");

    const transactionCallCountAfterFirstQueue =
      (prismaService.$transaction as jest.Mock).mock.calls.length;

    const secondResponse = await request(app.getHttpServer())
      .post("/transaction-intents/internal/deposit-requests/intent_1/queue")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({});

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.message).toBe(
      "Deposit request queue state reused successfully."
    );
    expect(secondResponse.body.data.queueReused).toBe(true);
    expect(secondResponse.body.data.intent.status).toBe("queued");
    expect((prismaService.$transaction as jest.Mock).mock.calls.length).toBe(
      transactionCallCountAfterFirstQueue
    );
  });

  it("records a manual deposit broadcast through the operator control-plane", async () => {
    currentIntent = buildReviewIntentRecord({
      status: "queued",
      policyDecision: "approved",
      updatedAt: new Date("2026-04-06T18:03:00.000Z")
    });

    const response = await request(app.getHttpServer())
      .post("/transaction-intents/internal/deposit-requests/intent_1/broadcast")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        txHash: `0x${"1".repeat(64)}`,
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000abc"
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      "Deposit custody broadcast recorded successfully."
    );
    expect(response.body.data.broadcastReused).toBe(false);
    expect(response.body.data.intent.status).toBe("broadcast");
    expect(prismaTransaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "operator",
          actorId: "ops_1",
          action: "transaction_intent.deposit.broadcast",
          metadata: expect.objectContaining({
            executionChannel: "manual_custody"
          })
        })
      })
    );
  });
});
