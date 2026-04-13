jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { WithdrawalIntentsInternalController } from "./withdrawal-intents-internal.controller";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

describe("WithdrawalIntentsInternalController", () => {
  let app: INestApplication;
  const withdrawalIntentsService = {
    recordWithdrawalBroadcastByOperator: jest.fn(),
    failWithdrawalIntentExecutionByOperator: jest.fn(),
    settleConfirmedWithdrawalIntentByOperator: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WithdrawalIntentsInternalController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: WithdrawalIntentsService,
          useValue: withdrawalIntentsService
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

  it("rejects missing operator authentication headers before reaching the handler", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/withdrawal-requests/intent_1/broadcast")
      .send({
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
      .expect(401);

    expect(
      withdrawalIntentsService.recordWithdrawalBroadcastByOperator
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed operator broadcast payloads", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/withdrawal-requests/intent_1/broadcast")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        txHash: "invalid",
        unexpected: true
      })
      .expect(400);

    expect(
      withdrawalIntentsService.recordWithdrawalBroadcastByOperator
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed operator failure payloads", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/withdrawal-requests/intent_1/fail")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        failureCode: "x",
        failureReason: "no",
        txHash: "invalid"
      })
      .expect(400);

    expect(
      withdrawalIntentsService.failWithdrawalIntentExecutionByOperator
    ).not.toHaveBeenCalled();
  });

  it("rejects settlement notes that exceed the governed limit", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/withdrawal-requests/intent_1/settle")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        note: "x".repeat(501)
      })
      .expect(400);

    expect(
      withdrawalIntentsService.settleConfirmedWithdrawalIntentByOperator
    ).not.toHaveBeenCalled();
  });

  it("passes the normalized operator identity and role through to broadcast recording", async () => {
    withdrawalIntentsService.recordWithdrawalBroadcastByOperator.mockResolvedValue(
      {
        broadcastReused: false,
        intent: {
          id: "intent_1",
          status: "broadcast"
        }
      }
    );

    const response = await request(app.getHttpServer())
      .post("/transaction-intents/internal/withdrawal-requests/intent_1/broadcast")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "Senior_Operator")
      .send({
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fromAddress: "0x0000000000000000000000000000000000000111",
        toAddress: "0x0000000000000000000000000000000000000222"
      })
      .expect(201);

    expect(
      withdrawalIntentsService.recordWithdrawalBroadcastByOperator
    ).toHaveBeenCalledWith(
      "intent_1",
      "ops_1",
      {
        txHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fromAddress: "0x0000000000000000000000000000000000000111",
        toAddress: "0x0000000000000000000000000000000000000222"
      },
      "senior_operator"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Withdrawal custody broadcast recorded successfully.",
      data: {
        broadcastReused: false,
        intent: {
          id: "intent_1",
          status: "broadcast"
        }
      }
    });
  });
});
