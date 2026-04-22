import {
  INestApplication,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  let app: INestApplication;
  const notificationsService = {
    listCustomerNotifications: jest.fn(),
    getCustomerUnreadSummary: jest.fn(),
    markCustomerNotificationsRead: jest.fn(),
    markAllCustomerNotificationsRead: jest.fn(),
    archiveCustomerNotifications: jest.fn(),
    getCustomerPreferences: jest.fn(),
    updateCustomerPreferences: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> };
        }) => {
          const request = context.switchToHttp().getRequest() as {
            headers: Record<string, string | string[] | undefined>;
            user?: { id: string };
          };

          if (request.headers.authorization !== "Bearer test-token") {
            throw new UnauthorizedException(
              "Customer authentication requires a bearer token.",
            );
          }

          request.user = { id: "supabase_customer_1" };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects malformed list query parameters before reaching the service", async () => {
    await request(app.getHttpServer())
      .get("/notifications/me")
      .set("Authorization", "Bearer test-token")
      .query({
        limit: "0",
      })
      .expect(400);

    expect(notificationsService.listCustomerNotifications).not.toHaveBeenCalled();
  });

  it("passes authenticated customer context through to the list handler", async () => {
    notificationsService.listCustomerNotifications.mockResolvedValue({
      items: [],
      unreadCount: 3,
      limit: 10,
    });

    const response = await request(app.getHttpServer())
      .get("/notifications/me")
      .set("Authorization", "Bearer test-token")
      .query({
        limit: "10",
        unreadOnly: "true",
        category: "security",
      })
      .expect(200);

    expect(notificationsService.listCustomerNotifications).toHaveBeenCalledWith(
      "supabase_customer_1",
      {
        limit: 10,
        unreadOnly: true,
        category: "security",
      },
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Notifications retrieved successfully.",
      data: {
        items: [],
        unreadCount: 3,
        limit: 10,
      },
    });
  });

  it("maps preference updates into the notification matrix payload", async () => {
    notificationsService.updateCustomerPreferences.mockResolvedValue({
      audience: "customer",
      updatedAt: null,
      entries: [
        {
          category: "security",
          channels: [
            {
              channel: "in_app",
              enabled: true,
              mandatory: true,
            },
          ],
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .patch("/notifications/me/preferences")
      .set("Authorization", "Bearer test-token")
      .send({
        entries: [
          {
            category: "security",
            channels: [
              {
                channel: "in_app",
                enabled: true,
              },
            ],
          },
        ],
      })
      .expect(200);

    expect(notificationsService.updateCustomerPreferences).toHaveBeenCalledWith(
      "supabase_customer_1",
      {
        audience: "customer",
        updatedAt: null,
        entries: [
          {
            category: "security",
            channels: [
              {
                channel: "in_app",
                enabled: true,
                mandatory: false,
              },
            ],
          },
        ],
      },
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Notification preferences updated successfully.",
      data: {
        notificationPreferences: {
          audience: "customer",
          updatedAt: null,
          entries: [
            {
              category: "security",
              channels: [
                {
                  channel: "in_app",
                  enabled: true,
                  mandatory: true,
                },
              ],
            },
          ],
        },
      },
    });
  });
});
