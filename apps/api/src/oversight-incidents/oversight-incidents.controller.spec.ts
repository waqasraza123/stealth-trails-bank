jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { OversightIncidentsController } from "./oversight-incidents.controller";
import { OversightIncidentsService } from "./oversight-incidents.service";

describe("OversightIncidentsController", () => {
  let app: INestApplication;
  const oversightIncidentsService = {
    listOversightIncidents: jest.fn(),
    addOversightIncidentNote: jest.fn(),
    applyAccountRestriction: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OversightIncidentsController],
      providers: [
        {
          provide: OversightIncidentsService,
          useValue: oversightIncidentsService
        }
      ]
    })
      .overrideGuard(InternalOperatorBearerGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();

          if (
            typeof request.headers.authorization !== "string" ||
            !request.headers.authorization.startsWith("Bearer ")
          ) {
            throw new UnauthorizedException(
              "Operator authentication requires a bearer token."
            );
          }

          request.internalOperator = {
            operatorId:
              typeof request.headers["x-operator-id"] === "string"
                ? request.headers["x-operator-id"]
                : "ops_1",
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

  it("rejects missing operator authentication headers before reaching oversight mutations", async () => {
    await request(app.getHttpServer())
      .post("/oversight-incidents/internal/incident_1/notes")
      .send({
        note: "Escalating for review."
      })
      .expect(401);

    expect(
      oversightIncidentsService.addOversightIncidentNote
    ).not.toHaveBeenCalled();
  });

  it("rejects governed oversight note payloads that exceed the limit", async () => {
    await request(app.getHttpServer())
      .post("/oversight-incidents/internal/incident_1/notes")
      .set("Authorization", "Bearer test-token")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        note: "x".repeat(2_001)
      })
      .expect(400);

    expect(
      oversightIncidentsService.addOversightIncidentNote
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed oversight incident list filters", async () => {
    await request(app.getHttpServer())
      .get("/oversight-incidents/internal")
      .set("Authorization", "Bearer test-token")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        assignedOperatorId: "a".repeat(201),
        reasonCode: "Policy Denied",
        email: "invalid-email"
      })
      .expect(400);

    expect(
      oversightIncidentsService.listOversightIncidents
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed account-hold payloads", async () => {
    await request(app.getHttpServer())
      .post("/oversight-incidents/internal/incident_1/place-account-hold")
      .set("Authorization", "Bearer test-token")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        restrictionReasonCode: "Risk Hold",
        note: "x".repeat(2_001),
        unexpected: true
      })
      .expect(400);

    expect(
      oversightIncidentsService.applyAccountRestriction
    ).not.toHaveBeenCalled();
  });

  it("passes governed oversight incident list filters through", async () => {
    oversightIncidentsService.listOversightIncidents.mockResolvedValue({
      incidents: [],
      limit: 20
    });

    const response = await request(app.getHttpServer())
      .get("/oversight-incidents/internal")
      .set("Authorization", "Bearer test-token")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "20",
        status: "open",
        incidentType: "customer_manual_resolution_spike",
        assignedOperatorId: "ops_1",
        subjectCustomerAccountId: "account_1",
        subjectOperatorId: "ops_2",
        email: "user@example.com",
        reasonCode: "policy_denied"
      })
      .expect(200);

    expect(oversightIncidentsService.listOversightIncidents).toHaveBeenCalledWith(
      {
        limit: 20,
        status: "open",
        incidentType: "customer_manual_resolution_spike",
        assignedOperatorId: "ops_1",
        subjectCustomerAccountId: "account_1",
        subjectOperatorId: "ops_2",
        email: "user@example.com",
        reasonCode: "policy_denied"
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Oversight incidents retrieved successfully.",
      data: {
        incidents: [],
        limit: 20
      }
    });
  });

  it("passes the normalized operator identity and role through to account restriction placement", async () => {
    oversightIncidentsService.applyAccountRestriction.mockResolvedValue({
      stateReused: false,
      oversightIncident: {
        id: "incident_1",
        status: "in_progress"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/oversight-incidents/internal/incident_1/place-account-hold")
      .set("Authorization", "Bearer test-token")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "Senior_Operator")
      .send({
        restrictionReasonCode: "oversight_risk_hold",
        note: "Applying a temporary hold while the review remains open."
      })
      .expect(201);

    expect(
      oversightIncidentsService.applyAccountRestriction
    ).toHaveBeenCalledWith(
      "incident_1",
      "ops_1",
      "senior_operator",
      {
        restrictionReasonCode: "oversight_risk_hold",
        note: "Applying a temporary hold while the review remains open."
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Account hold placed successfully.",
      data: {
        stateReused: false,
        oversightIncident: {
          id: "incident_1",
          status: "in_progress"
        }
      }
    });
  });
});
