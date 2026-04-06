import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { TransactionIntentsController } from "./transaction-intents.controller";
import { TransactionIntentsService } from "./transaction-intents.service";

function buildIntentRecord(
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
    ...overrides
  };
}

describe("TransactionIntentsController integration", () => {
  let app: INestApplication;

  const authService = {
    validateToken: jest.fn()
  };

  const prismaTransaction = {
    transactionIntent: {
      create: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const prismaService = {
    customerAccount: {
      findFirst: jest.fn()
    },
    asset: {
      findUnique: jest.fn()
    },
    transactionIntent: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (callback: (tx: typeof prismaTransaction) => unknown) =>
      callback(prismaTransaction)
    )
  };

  beforeAll(async () => {
    const integrationApp = await createIntegrationTestApp({
      controllers: [TransactionIntentsController],
      providers: [
        TransactionIntentsService,
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: authService
        },
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

    authService.validateToken.mockResolvedValue({
      id: "supabase_1"
    });
    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: "active",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      status: "active"
    });
    prismaService.transactionIntent.findUnique.mockResolvedValue(null);
    prismaTransaction.transactionIntent.create.mockResolvedValue(
      buildIntentRecord()
    );
    prismaTransaction.auditEvent.create.mockResolvedValue({
      id: "audit_1"
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated deposit intent creation requests", async () => {
    const response = await request(app.getHttpServer())
      .post("/transaction-intents/deposit-requests")
      .send({
        idempotencyKey: "deposit-intent-001",
        assetSymbol: "USDC",
        amount: "125.50"
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authorization header is missing.");
  });

  it("rejects invalid deposit intent payloads before service execution", async () => {
    const response = await request(app.getHttpServer())
      .post("/transaction-intents/deposit-requests")
      .set("Authorization", "Bearer test-token")
      .send({
        idempotencyKey: "short",
        assetSymbol: "U",
        amount: "abc"
      });

    expect(response.status).toBe(400);
    expect(prismaService.customerAccount.findFirst).not.toHaveBeenCalled();
  });

  it("creates a deposit intent over HTTP and writes the audit trail", async () => {
    const response = await request(app.getHttpServer())
      .post("/transaction-intents/deposit-requests")
      .set("Authorization", "Bearer test-token")
      .send({
        idempotencyKey: "deposit-intent-001",
        assetSymbol: "usdc",
        amount: "125.50"
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      status: "success",
      message: "Deposit request created successfully.",
      data: {
        idempotencyReused: false,
        intent: {
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
          sourceWalletAddress: null,
          destinationWalletId: "wallet_1",
          destinationWalletAddress: "0x0000000000000000000000000000000000000abc",
          externalAddress: null,
          chainId: 8453,
          intentType: "deposit",
          status: "requested",
          policyDecision: "pending",
          requestedAmount: "125.5",
          settledAmount: null,
          idempotencyKey: "deposit-intent-001",
          failureCode: null,
          failureReason: null,
          createdAt: "2026-04-06T18:00:00.000Z",
          updatedAt: "2026-04-06T18:00:00.000Z"
        }
      }
    });
    expect(prismaService.customerAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customer: {
            supabaseUserId: "supabase_1"
          }
        }
      })
    );
    expect(prismaTransaction.transactionIntent.create).toHaveBeenCalled();
    expect(prismaTransaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer_1",
          actorType: "customer",
          actorId: "supabase_1",
          action: "transaction_intent.deposit.requested"
        })
      })
    );
  });

  it("reuses an existing deposit intent for the same idempotency key", async () => {
    prismaService.transactionIntent.findUnique.mockResolvedValue(
      buildIntentRecord({
        id: "intent_existing"
      })
    );

    const response = await request(app.getHttpServer())
      .post("/transaction-intents/deposit-requests")
      .set("Authorization", "Bearer test-token")
      .send({
        idempotencyKey: "deposit-intent-001",
        assetSymbol: "USDC",
        amount: "125.50"
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Deposit request reused successfully.");
    expect(response.body.data.idempotencyReused).toBe(true);
    expect(response.body.data.intent.id).toBe("intent_existing");
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });
});
