jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalWorkerRuntimeConfig: () => ({
    internalWorkerApiKey: "test-worker-key"
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";
import { WithdrawalIntentsWorkerController } from "./withdrawal-intents-worker.controller";

describe("WithdrawalIntentsWorkerController", () => {
  let app: INestApplication;
  const withdrawalIntentsService = {
    listQueuedWithdrawalIntents: jest.fn(),
    recordSignedWithdrawalExecution: jest.fn(),
    settleConfirmedWithdrawalIntent: jest.fn()
  };
  const prismaService = {
    asset: {
      findMany: jest.fn()
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WithdrawalIntentsWorkerController],
      providers: [
        InternalWorkerApiKeyGuard,
        {
          provide: WithdrawalIntentsService,
          useValue: withdrawalIntentsService
        },
        {
          provide: PrismaService,
          useValue: prismaService
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects missing worker authentication headers before reaching worker endpoints", async () => {
    await request(app.getHttpServer())
      .get("/transaction-intents/internal/worker/withdrawal-requests/queued")
      .expect(401);

    expect(
      withdrawalIntentsService.listQueuedWithdrawalIntents
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed signed execution payloads", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/worker/withdrawal-requests/intent_1/signed")
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .send({
        txHash: "invalid",
        nonce: -1,
        serializedTransaction: "0xxyz",
        unexpected: true
      })
      .expect(400);

    expect(
      withdrawalIntentsService.recordSignedWithdrawalExecution
    ).not.toHaveBeenCalled();
  });

  it("rejects settlement notes that exceed the governed limit", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/worker/withdrawal-requests/intent_1/settle")
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .send({
        note: "x".repeat(501)
      })
      .expect(400);

    expect(
      withdrawalIntentsService.settleConfirmedWithdrawalIntent
    ).not.toHaveBeenCalled();
  });

  it("returns queued intents with asset execution metadata for worker processing", async () => {
    withdrawalIntentsService.listQueuedWithdrawalIntents.mockResolvedValue({
      intents: [
        {
          id: "intent_1",
          asset: {
            id: "asset_1",
            symbol: "USDC",
            displayName: "USD Coin",
            decimals: 6,
            chainId: 8453
          }
        }
      ],
      limit: 20
    });
    prismaService.asset.findMany.mockResolvedValue([
      {
        id: "asset_1",
        assetType: "erc20",
        contractAddress: "0x0000000000000000000000000000000000000333"
      }
    ]);

    const response = await request(app.getHttpServer())
      .get(
        "/transaction-intents/internal/worker/withdrawal-requests/queued?limit=20"
      )
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .expect(200);

    expect(
      withdrawalIntentsService.listQueuedWithdrawalIntents
    ).toHaveBeenCalledWith({
      limit: 20
    });
    expect(prismaService.asset.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["asset_1"]
        }
      },
      select: {
        id: true,
        assetType: true,
        contractAddress: true
      }
    });
    expect(response.body.data.intents[0].asset).toMatchObject({
      id: "asset_1",
      symbol: "USDC",
      assetType: "erc20",
      contractAddress: "0x0000000000000000000000000000000000000333"
    });
  });

  it("passes the authenticated worker id to signed execution recording", async () => {
    withdrawalIntentsService.recordSignedWithdrawalExecution.mockResolvedValue({
      signedStateReused: false,
      intent: {
        id: "intent_1",
        status: "signed"
      }
    });

    await request(app.getHttpServer())
      .post("/transaction-intents/internal/worker/withdrawal-requests/intent_1/signed")
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .send({
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        nonce: 7,
        serializedTransaction: "0x02abcd",
        fromAddress: "0x0000000000000000000000000000000000000111",
        toAddress: "0x0000000000000000000000000000000000000222"
      })
      .expect(201);

    expect(
      withdrawalIntentsService.recordSignedWithdrawalExecution
    ).toHaveBeenCalledWith(
      "intent_1",
      "worker_1",
      {
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        nonce: 7,
        serializedTransaction: "0x02abcd",
        fromAddress: "0x0000000000000000000000000000000000000111",
        toAddress: "0x0000000000000000000000000000000000000222"
      }
    );
  });
});
