jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  }),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { LedgerReconciliationController } from "./ledger-reconciliation.controller";
import { LedgerReconciliationService } from "./ledger-reconciliation.service";

describe("LedgerReconciliationController", () => {
  let app: INestApplication;
  const ledgerReconciliationService = {
    listScanRuns: jest.fn(),
    listMismatches: jest.fn(),
    requestReplayApprovalForMismatch: jest.fn(),
    replayConfirmMismatch: jest.fn(),
    replaySettleMismatch: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LedgerReconciliationController],
      providers: [
        {
          provide: LedgerReconciliationService,
          useValue: ledgerReconciliationService
        }
      ]
    })
      .overrideGuard(InternalOperatorApiKeyGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.internalOperator = {
            operatorId:
              typeof request.headers["x-operator-id"] === "string"
                ? request.headers["x-operator-id"]
                : "ops_1",
            operatorRole:
              typeof request.headers["x-operator-role"] === "string"
                ? request.headers["x-operator-role"]
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

  it("rejects malformed ledger reconciliation run filters", async () => {
    await request(app.getHttpServer())
      .get("/ledger/internal/reconciliation/runs")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        workerId: "a".repeat(201)
      })
      .expect(400);

    expect(ledgerReconciliationService.listScanRuns).not.toHaveBeenCalled();
  });

  it("passes governed ledger reconciliation run filters through", async () => {
    ledgerReconciliationService.listScanRuns.mockResolvedValue({
      runs: [],
      limit: 25
    });

    const response = await request(app.getHttpServer())
      .get("/ledger/internal/reconciliation/runs")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "25",
        status: "succeeded",
        triggerSource: "worker",
        scope: "transaction_intent",
        customerAccountId: "account_1",
        transactionIntentId: "intent_1",
        workerId: "worker_1"
      })
      .expect(200);

    expect(ledgerReconciliationService.listScanRuns).toHaveBeenCalledWith({
      limit: 25,
      status: "succeeded",
      triggerSource: "worker",
      scope: "transaction_intent",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      workerId: "worker_1"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Ledger reconciliation scan runs retrieved successfully.",
      data: {
        runs: [],
        limit: 25
      }
    });
  });

  it("rejects malformed ledger reconciliation mismatch filters", async () => {
    await request(app.getHttpServer())
      .get("/ledger/internal/reconciliation/mismatches")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        reasonCode: "Mismatch Found",
        email: "invalid-email"
      })
      .expect(400);

    expect(ledgerReconciliationService.listMismatches).not.toHaveBeenCalled();
  });

  it("passes governed ledger reconciliation mismatch filters through", async () => {
    ledgerReconciliationService.listMismatches.mockResolvedValue({
      mismatches: [],
      limit: 20
    });

    const response = await request(app.getHttpServer())
      .get("/ledger/internal/reconciliation/mismatches")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "20",
        status: "open",
        scope: "transaction_intent",
        recommendedAction: "open_review_case",
        reasonCode: "customer_asset_balance_projection_unrepairable",
        customerAccountId: "account_1",
        transactionIntentId: "intent_1",
        email: "user@example.com"
      })
      .expect(200);

    expect(ledgerReconciliationService.listMismatches).toHaveBeenCalledWith({
      limit: 20,
      status: "open",
      scope: "transaction_intent",
      recommendedAction: "open_review_case",
      reasonCode: "customer_asset_balance_projection_unrepairable",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      email: "user@example.com"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Ledger reconciliation mismatches retrieved successfully.",
      data: {
        mismatches: [],
        limit: 20
      }
    });
  });

  it("passes governed replay-confirm payload through with approval context", async () => {
    ledgerReconciliationService.replayConfirmMismatch.mockResolvedValue({
      mismatch: {
        id: "mismatch_1"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/ledger/internal/reconciliation/mismatches/mismatch_1/replay-confirm")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        approvalRequestId: "approval_1",
        note: "Replay from controller."
      })
      .expect(201);

    expect(ledgerReconciliationService.replayConfirmMismatch).toHaveBeenCalledWith(
      "mismatch_1",
      "ops_1",
      "operations_admin",
      "approval_1",
      "Replay from controller."
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Ledger reconciliation confirm replay completed successfully.",
      data: {
        mismatch: {
          id: "mismatch_1"
        }
      }
    });
  });

  it("passes governed replay-approval requests through", async () => {
    ledgerReconciliationService.requestReplayApprovalForMismatch.mockResolvedValue({
      mismatch: {
        id: "mismatch_1"
      },
      request: {
        id: "approval_1"
      },
      stateReused: false
    });

    const response = await request(app.getHttpServer())
      .post(
        "/ledger/internal/reconciliation/mismatches/mismatch_1/request-replay-approval"
      )
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        replayAction: "confirm",
        note: "Need governed replay approval."
      })
      .expect(201);

    expect(
      ledgerReconciliationService.requestReplayApprovalForMismatch
    ).toHaveBeenCalledWith(
      "mismatch_1",
      "ops_1",
      "operations_admin",
      {
        replayAction: "confirm",
        note: "Need governed replay approval."
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message:
        "Ledger reconciliation replay approval request created successfully.",
      data: {
        mismatch: {
          id: "mismatch_1"
        },
        request: {
          id: "approval_1"
        },
        stateReused: false
      }
    });
  });

  it("rejects malformed replay-confirm payloads", async () => {
    await request(app.getHttpServer())
      .post("/ledger/internal/reconciliation/mismatches/mismatch_1/replay-confirm")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        approvalRequestId: "a".repeat(192)
      })
      .expect(400);

    expect(ledgerReconciliationService.replayConfirmMismatch).not.toHaveBeenCalled();
  });

  it("rejects malformed replay-approval payloads", async () => {
    await request(app.getHttpServer())
      .post(
        "/ledger/internal/reconciliation/mismatches/mismatch_1/request-replay-approval"
      )
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        replayAction: "invalid"
      })
      .expect(400);

    expect(
      ledgerReconciliationService.requestReplayApprovalForMismatch
    ).not.toHaveBeenCalled();
  });
});
