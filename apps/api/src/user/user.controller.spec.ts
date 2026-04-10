import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController", () => {
  let app: INestApplication;
  const authService = {
    validateToken: jest.fn()
  };
  const userService = {
    getUserById: jest.fn(),
    updateNotificationPreferences: jest.fn()
  };

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [UserController],
      providers: [
        {
          provide: AuthService,
          useValue: authService
        },
        {
          provide: UserService,
          useValue: userService
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

  it("rejects cross-user notification preference updates", async () => {
    await request(app.getHttpServer())
      .patch("/user/supabase_2/notification-preferences")
      .set("Authorization", "Bearer test-token")
      .send({
        depositEmails: true,
        withdrawalEmails: true,
        loanEmails: true,
        productUpdateEmails: false
      })
      .expect(401);

    expect(userService.updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it("passes normalized notification preference updates to the service", async () => {
    userService.updateNotificationPreferences.mockResolvedValue({
      depositEmails: false,
      withdrawalEmails: true,
      loanEmails: false,
      productUpdateEmails: true
    });

    const response = await request(app.getHttpServer())
      .patch("/user/supabase_1/notification-preferences")
      .set("Authorization", "Bearer test-token")
      .send({
        depositEmails: false,
        withdrawalEmails: true,
        loanEmails: false,
        productUpdateEmails: true
      })
      .expect(200);

    expect(userService.updateNotificationPreferences).toHaveBeenCalledWith(
      "supabase_1",
      {
        depositEmails: false,
        withdrawalEmails: true,
        loanEmails: false,
        productUpdateEmails: true
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Notification preferences updated successfully.",
      data: {
        notificationPreferences: {
          depositEmails: false,
          withdrawalEmails: true,
          loanEmails: false,
          productUpdateEmails: true
        }
      }
    });
  });
});
