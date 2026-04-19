jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { TransactionIntentsInternalController } from "./transaction-intents-internal.controller";
import { TransactionIntentsService } from "./transaction-intents.service";

describe("TransactionIntentsInternalController", () => {
  let app: INestApplication;
  const transactionIntentsService = {
    decideDepositIntent: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionIntentsInternalController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: TransactionIntentsService,
          useValue: transactionIntentsService
        }
      ]
    })
      .overrideGuard(InternalOperatorApiKeyGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const request = context.switchToHttp().getRequest() as {
            headers: Record<string, string | string[] | undefined>;
            internalOperator?: {
              operatorId: string;
              operatorRole: string | null;
            };
          };
          const apiKey = request.headers["x-operator-api-key"];
          const operatorId = request.headers["x-operator-id"];

          if (apiKey !== "test-operator-key" || typeof operatorId !== "string") {
            throw new UnauthorizedException(
              "Operator authentication requires a bearer token or an allowed legacy operator API key."
            );
          }

          request.internalOperator = {
            operatorId,
            operatorRole:
              typeof request.headers["x-operator-role"] === "string"
                ? request.headers["x-operator-role"].toLowerCase()
                : null
          };

          return true;
        }
      })
      .compile();

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
      .post("/transaction-intents/internal/deposit-requests/intent_1/decision")
      .send({
        decision: "approved"
      })
      .expect(401);

    expect(transactionIntentsService.decideDepositIntent).not.toHaveBeenCalled();
  });

  it("rejects malformed operator decision payloads", async () => {
    await request(app.getHttpServer())
      .post("/transaction-intents/internal/deposit-requests/intent_1/decision")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        decision: "approved",
        unexpected: true
      })
      .expect(400);

    expect(transactionIntentsService.decideDepositIntent).not.toHaveBeenCalled();
  });

  it("passes the normalized operator identity and role through to the service", async () => {
    transactionIntentsService.decideDepositIntent.mockResolvedValue({
      intent: {
        id: "intent_1",
        status: "approved"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/transaction-intents/internal/deposit-requests/intent_1/decision")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "Risk_Manager")
      .send({
        decision: "approved",
        note: "Approved after review."
      })
      .expect(201);

    expect(transactionIntentsService.decideDepositIntent).toHaveBeenCalledWith(
      "intent_1",
      "ops_1",
      {
        decision: "approved",
        note: "Approved after review."
      },
      "risk_manager"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Deposit request approved successfully.",
      data: {
        intent: {
          id: "intent_1",
          status: "approved"
        }
      }
    });
  });
});
