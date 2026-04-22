import {
  INestApplication,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { NotificationsInternalController } from "./notifications-internal.controller";
import { NotificationsService } from "./notifications.service";

describe("NotificationsInternalController", () => {
  let app: INestApplication;
  const notificationsService = {
    listOperatorNotifications: jest.fn(),
    getOperatorUnreadSummary: jest.fn(),
    markOperatorNotificationsRead: jest.fn(),
    markAllOperatorNotificationsRead: jest.fn(),
    archiveOperatorNotifications: jest.fn(),
    getOperatorPreferences: jest.fn(),
    updateOperatorPreferences: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsInternalController],
      providers: [
        InternalOperatorBearerGuard,
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    })
      .overrideGuard(InternalOperatorBearerGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> };
        }) => {
          const request = context.switchToHttp().getRequest() as {
            headers: Record<string, string | string[] | undefined>;
            internalOperator?: { operatorId: string };
          };

          if (request.headers.authorization !== "Bearer test-operator-token") {
            throw new UnauthorizedException(
              "Operator authentication requires a bearer token.",
            );
          }

          request.internalOperator = { operatorId: "ops_1" };
          return true;
        },
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

  it("rejects malformed operator list query parameters before reaching the service", async () => {
    await request(app.getHttpServer())
      .get("/notifications/internal/me")
      .set("Authorization", "Bearer test-operator-token")
      .query({
        limit: "200",
      })
      .expect(400);

    expect(notificationsService.listOperatorNotifications).not.toHaveBeenCalled();
  });

  it("passes operator identity through to the list handler", async () => {
    notificationsService.listOperatorNotifications.mockResolvedValue({
      items: [],
      unreadCount: 2,
      limit: 20,
    });

    const response = await request(app.getHttpServer())
      .get("/notifications/internal/me")
      .set("Authorization", "Bearer test-operator-token")
      .query({
        unreadOnly: "true",
      })
      .expect(200);

    expect(notificationsService.listOperatorNotifications).toHaveBeenCalledWith(
      "ops_1",
      {
        unreadOnly: true,
      },
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Operator notifications retrieved successfully.",
      data: {
        items: [],
        unreadCount: 2,
        limit: 20,
      },
    });
  });

  it("maps operator preference updates into the notification matrix payload", async () => {
    notificationsService.updateOperatorPreferences.mockResolvedValue({
      audience: "operator",
      updatedAt: null,
      entries: [
        {
          category: "incident",
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
      .patch("/notifications/internal/me/preferences")
      .set("Authorization", "Bearer test-operator-token")
      .send({
        entries: [
          {
            category: "incident",
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

    expect(notificationsService.updateOperatorPreferences).toHaveBeenCalledWith(
      "ops_1",
      {
        audience: "operator",
        updatedAt: null,
        entries: [
          {
            category: "incident",
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
      message: "Operator notification preferences updated successfully.",
      data: {
        notificationPreferences: {
          audience: "operator",
          updatedAt: null,
          entries: [
            {
              category: "incident",
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
