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
import { TransactionIntentsService } from "./transaction-intents.service";
import { TransactionIntentsWorkerController } from "./transaction-intents-worker.controller";

describe("TransactionIntentsWorkerController", () => {
  let app: INestApplication;
  const transactionIntentsService = {
    listQueuedDepositIntents: jest.fn(),
    recordDepositBroadcast: jest.fn()
  };
  const prismaService = {
    asset: {
      findMany: jest.fn()
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionIntentsWorkerController],
      providers: [
        InternalWorkerApiKeyGuard,
        {
          provide: TransactionIntentsService,
          useValue: transactionIntentsService
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
      .get("/transaction-intents/internal/worker/deposit-requests/queued")
      .expect(401);

    expect(transactionIntentsService.listQueuedDepositIntents).not.toHaveBeenCalled();
  });

  it("rejects malformed worker broadcast payloads", async () => {
    await request(app.getHttpServer())
      .post(
        "/transaction-intents/internal/worker/deposit-requests/intent_1/broadcast"
      )
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .send({
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fromAddress: "0x0000000000000000000000000000000000000abc",
        unexpected: true
      })
      .expect(400);

    expect(transactionIntentsService.recordDepositBroadcast).not.toHaveBeenCalled();
  });

  it("returns queued intents with asset execution metadata for worker processing", async () => {
    transactionIntentsService.listQueuedDepositIntents.mockResolvedValue({
      intents: [
        {
          id: "intent_1",
          asset: {
            id: "asset_1",
            symbol: "ETH",
            displayName: "Ether",
            decimals: 18,
            chainId: 8453
          }
        }
      ],
      limit: 20
    });
    prismaService.asset.findMany.mockResolvedValue([
      {
        id: "asset_1",
        assetType: "native",
        contractAddress: null
      }
    ]);

    const response = await request(app.getHttpServer())
      .get("/transaction-intents/internal/worker/deposit-requests/queued?limit=20")
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .expect(200);

    expect(transactionIntentsService.listQueuedDepositIntents).toHaveBeenCalledWith({
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
      symbol: "ETH",
      assetType: "native",
      contractAddress: null
    });
  });

  it("passes the authenticated worker id to broadcast recording", async () => {
    transactionIntentsService.recordDepositBroadcast.mockResolvedValue({
      broadcastReused: false,
      intent: {
        id: "intent_1",
        status: "broadcast"
      }
    });

    await request(app.getHttpServer())
      .post(
        "/transaction-intents/internal/worker/deposit-requests/intent_1/broadcast"
      )
      .set("x-worker-api-key", "test-worker-key")
      .set("x-worker-id", "worker_1")
      .send({
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fromAddress: "0x0000000000000000000000000000000000000abc",
        toAddress: "0x0000000000000000000000000000000000000def"
      })
      .expect(201);

    expect(transactionIntentsService.recordDepositBroadcast).toHaveBeenCalledWith(
      "intent_1",
      "worker_1",
      {
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fromAddress: "0x0000000000000000000000000000000000000abc",
        toAddress: "0x0000000000000000000000000000000000000def"
      }
    );
  });
});
