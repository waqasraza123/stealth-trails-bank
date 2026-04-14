jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { OversightIncidentsController } from "./oversight-incidents.controller";
import { OversightIncidentsService } from "./oversight-incidents.service";

describe("OversightIncidentsController", () => {
  let app: INestApplication;
  const oversightIncidentsService = {
    addOversightIncidentNote: jest.fn(),
    applyAccountRestriction: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OversightIncidentsController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: OversightIncidentsService,
          useValue: oversightIncidentsService
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

  it("rejects malformed account-hold payloads", async () => {
    await request(app.getHttpServer())
      .post("/oversight-incidents/internal/incident_1/place-account-hold")
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
