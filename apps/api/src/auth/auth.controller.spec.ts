import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { InternalOperatorBearerGuard } from "./guards/internal-operator-bearer.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OperatorIdentityService } from "./operator-identity.service";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";

describe("AuthController", () => {
  let app: INestApplication;
  const authService = {
    signUp: jest.fn(),
    login: jest.fn(),
    updatePassword: jest.fn(),
    revokeAllCustomerSessions: jest.fn(),
    startEmailRecovery: jest.fn(),
    verifyEmailRecovery: jest.fn(),
    listCustomerMfaRecoveryRequests: jest.fn(),
    requestCustomerMfaRecovery: jest.fn(),
    approveCustomerMfaRecoveryRequest: jest.fn(),
    rejectCustomerMfaRecoveryRequest: jest.fn(),
    executeCustomerMfaRecoveryRequest: jest.fn(),
    validateToken: jest.fn(),
    getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
    getCustomerWalletProjectionBySupabaseUserId: jest.fn(),
    getOperatorSession: jest.fn(),
  };

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: OperatorIdentityService,
          useValue: {
            resolveFromBearerToken: jest.fn(async () => ({
              operatorId: "ops_1",
              operatorRole: "operations_admin",
              operatorRoles: ["operations_admin"],
              operatorDbId: "operator_db_1",
              operatorSupabaseUserId: "operator_supabase_1",
              operatorEmail: "ops@example.com",
              authSource: "supabase_jwt",
              environment: "development",
              sessionCorrelationId: "session_1",
            })),
          },
        },
        InternalOperatorBearerGuard,
        JwtAuthGuard,
      ],
    });

    app = result.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.validateToken.mockResolvedValue({
      id: "supabase_1",
      email: "amina@example.com",
    });
  });

  it("rejects too-short password rotations before reaching the service", async () => {
    await request(app.getHttpServer())
      .patch("/auth/password")
      .set("Authorization", "Bearer test-token")
      .send({
        currentPassword: "current-pass",
        newPassword: "123",
      })
      .expect(400);

    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it("passes the authenticated customer identity to the password rotation service", async () => {
    authService.updatePassword.mockResolvedValue({
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true,
        session: {
          token: "rotated-token",
          revokedOtherSessions: true,
        },
      },
    });

    const response = await request(app.getHttpServer())
      .patch("/auth/password")
      .set("Authorization", "Bearer test-token")
      .send({
        currentPassword: "current-pass",
        newPassword: "new-strong-pass",
      })
      .expect(200);

    expect(authService.updatePassword).toHaveBeenCalledWith(
      "supabase_1",
      "current-pass",
      "new-strong-pass",
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true,
        session: {
          token: "rotated-token",
          revokedOtherSessions: true,
        },
      },
    });
  });

  it("passes the authenticated customer identity to revoke all sessions", async () => {
    authService.revokeAllCustomerSessions.mockResolvedValue({
      status: "success",
      message: "Customer sessions revoked successfully.",
      data: {
        session: {
          token: "fresh-token",
          revokedOtherSessions: true,
        },
      },
    });

    const response = await request(app.getHttpServer())
      .post("/auth/session/revoke-all")
      .set("Authorization", "Bearer test-token")
      .expect(201);

    expect(authService.revokeAllCustomerSessions).toHaveBeenCalledWith(
      "supabase_1",
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Customer sessions revoked successfully.",
      data: {
        session: {
          token: "fresh-token",
          revokedOtherSessions: true,
        },
      },
    });
  });

  it("passes the authenticated customer identity to email recovery endpoints", async () => {
    authService.startEmailRecovery.mockResolvedValue({
      status: "success",
      message: "Customer MFA recovery challenge created successfully.",
      data: {
        challengeId: "challenge_1",
      },
    });
    authService.verifyEmailRecovery.mockResolvedValue({
      status: "success",
      message: "Customer MFA recovery completed successfully.",
      data: {
        session: {
          token: "fresh-token",
          revokedOtherSessions: true,
        },
      },
    });

    await request(app.getHttpServer())
      .post("/auth/mfa/recovery/email/start")
      .set("Authorization", "Bearer test-token")
      .expect(201);

    expect(authService.startEmailRecovery).toHaveBeenCalledWith("supabase_1");

    await request(app.getHttpServer())
      .post("/auth/mfa/recovery/email/verify")
      .set("Authorization", "Bearer test-token")
      .send({
        challengeId: "challenge_1",
        code: "123456",
      })
      .expect(201);

    expect(authService.verifyEmailRecovery).toHaveBeenCalledWith(
      "supabase_1",
      "challenge_1",
      "123456",
    );
  });

  it("passes internal operator customer MFA recovery endpoints through", async () => {
    authService.listCustomerMfaRecoveryRequests.mockResolvedValue({
      requests: [],
      limit: 25,
      totalCount: 0,
      summary: {
        byStatus: [],
      },
    });
    authService.requestCustomerMfaRecovery.mockResolvedValue({
      request: {
        id: "req_1",
      },
      stateReused: false,
    });
    authService.approveCustomerMfaRecoveryRequest.mockResolvedValue({
      request: {
        id: "req_1",
      },
      stateReused: false,
    });
    authService.rejectCustomerMfaRecoveryRequest.mockResolvedValue({
      request: {
        id: "req_1",
      },
      stateReused: false,
    });
    authService.executeCustomerMfaRecoveryRequest.mockResolvedValue({
      request: {
        id: "req_1",
      },
      stateReused: false,
    });

    await request(app.getHttpServer())
      .get("/auth/internal/customer-mfa-recovery-requests")
      .set("Authorization", "Bearer operator-token")
      .expect(200);

    expect(authService.listCustomerMfaRecoveryRequests).toHaveBeenCalledWith(
      {},
    );

    await request(app.getHttpServer())
      .post("/auth/internal/customer-mfa-recovery/supabase_1/request")
      .set("Authorization", "Bearer operator-token")
      .send({
        requestType: "release_lockout",
        note: "Operator verified customer identity.",
      })
      .expect(201);

    expect(authService.requestCustomerMfaRecovery).toHaveBeenCalledWith(
      "supabase_1",
      "ops_1",
      "operations_admin",
      {
        requestType: "release_lockout",
        note: "Operator verified customer identity.",
      },
    );

    await request(app.getHttpServer())
      .post("/auth/internal/customer-mfa-recovery-requests/req_1/approve")
      .set("Authorization", "Bearer operator-token")
      .send({
        note: "Dual control approved.",
      })
      .expect(201);

    expect(authService.approveCustomerMfaRecoveryRequest).toHaveBeenCalledWith(
      "req_1",
      "ops_1",
      "operations_admin",
      "Dual control approved.",
    );

    await request(app.getHttpServer())
      .post("/auth/internal/customer-mfa-recovery-requests/req_1/reject")
      .set("Authorization", "Bearer operator-token")
      .send({
        note: "Identity evidence was insufficient.",
      })
      .expect(201);

    expect(authService.rejectCustomerMfaRecoveryRequest).toHaveBeenCalledWith(
      "req_1",
      "ops_1",
      "operations_admin",
      "Identity evidence was insufficient.",
    );

    await request(app.getHttpServer())
      .post("/auth/internal/customer-mfa-recovery-requests/req_1/execute")
      .set("Authorization", "Bearer operator-token")
      .send({
        note: "Operator executed the approved reset.",
      })
      .expect(201);

    expect(authService.executeCustomerMfaRecoveryRequest).toHaveBeenCalledWith(
      "req_1",
      "ops_1",
      "operations_admin",
      "Operator executed the approved reset.",
    );
  });
});
