import type { ExecutionContext, INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { InternalOperatorBearerGuard } from "./guards/internal-operator-bearer.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";

describe("AuthController", () => {
  let app: INestApplication;
  const authService = {
    signUp: jest.fn(),
    login: jest.fn(),
    updatePassword: jest.fn(),
    validateToken: jest.fn(),
    getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
    getCustomerWalletProjectionBySupabaseUserId: jest.fn(),
    getOperatorSession: jest.fn()
  };

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService
        },
        {
          provide: InternalOperatorBearerGuard,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const request = context.switchToHttp().getRequest();
              request.internalOperator = {
                operatorId: "ops_1",
                operatorRole: "operations_admin",
                operatorRoles: ["operations_admin"],
                authSource: "supabase_jwt",
                environment: "development",
                sessionCorrelationId: "session_1"
              };

              return true;
            }
          }
        },
        JwtAuthGuard
      ]
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
      email: "amina@example.com"
    });
  });

  it("rejects too-short password rotations before reaching the service", async () => {
    await request(app.getHttpServer())
      .patch("/auth/password")
      .set("Authorization", "Bearer test-token")
      .send({
        currentPassword: "current-pass",
        newPassword: "123"
      })
      .expect(400);

    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it("passes the authenticated customer identity to the password rotation service", async () => {
    authService.updatePassword.mockResolvedValue({
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true
      }
    });

    const response = await request(app.getHttpServer())
      .patch("/auth/password")
      .set("Authorization", "Bearer test-token")
      .send({
        currentPassword: "current-pass",
        newPassword: "new-strong-pass"
      })
      .expect(200);

    expect(authService.updatePassword).toHaveBeenCalledWith(
      "supabase_1",
      "current-pass",
      "new-strong-pass"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true
      }
    });
  });
});
