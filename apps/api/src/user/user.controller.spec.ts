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
    validateToken: jest.fn(),
  };
  const userService = {
    getUserById: jest.fn(),
    updateAgeProfile: jest.fn(),
    createTrustedContact: jest.fn(),
    updateTrustedContact: jest.fn(),
    removeTrustedContact: jest.fn(),
  };

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [UserController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: UserService,
          useValue: userService,
        },
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

  it("returns the authenticated user's profile projection", async () => {
    userService.getUserById.mockResolvedValue({
      id: 1,
      customerId: "customer_1",
      supabaseUserId: "supabase_1",
      email: "amina@example.com",
      firstName: "Amina",
      lastName: "Rahman",
      ethereumAddress: "0x1234",
      accountStatus: "active",
      activatedAt: "2026-04-22T10:00:00.000Z",
      restrictedAt: null,
      frozenAt: null,
      closedAt: null,
      passwordRotationAvailable: true,
      notificationPreferences: {
        audience: "customer",
        supportedChannels: ["in_app", "email"],
        updatedAt: null,
        entries: [],
      },
      ageProfile: null,
      trustedContacts: [],
      mfa: {
        required: true,
        totpEnrolled: false,
        emailOtpEnrolled: false,
        requiresSetup: true,
        moneyMovementBlocked: true,
        stepUpFreshUntil: null,
        lockedUntil: null,
      },
      sessionSecurity: {
        currentSessionTrusted: true,
        currentSessionRequiresVerification: false,
      },
    });

    const response = await request(app.getHttpServer())
      .get("/user/supabase_1")
      .set("Authorization", "Bearer test-token")
      .expect(200);

    expect(userService.getUserById).toHaveBeenCalledWith("supabase_1", null);
    expect(response.body.data.notificationPreferences.supportedChannels).toEqual([
      "in_app",
      "email",
    ]);
  });

  it("passes age profile updates to the service", async () => {
    userService.updateAgeProfile.mockResolvedValue({
      dateOfBirth: "1991-05-12",
      ageYears: 34,
      legalAdult: true,
      verificationStatus: "self_attested",
      verifiedAt: null,
      verifiedByOperatorId: null,
      verificationNote: null,
    });

    const response = await request(app.getHttpServer())
      .patch("/user/supabase_1/age-profile")
      .set("Authorization", "Bearer test-token")
      .send({
        dateOfBirth: "1991-05-12",
      })
      .expect(200);

    expect(userService.updateAgeProfile).toHaveBeenCalledWith("supabase_1", {
      dateOfBirth: "1991-05-12",
    });
    expect(response.body.data.ageProfile.dateOfBirth).toBe("1991-05-12");
  });

  it("creates trusted contacts through the controller", async () => {
    userService.createTrustedContact.mockResolvedValue({
      id: "contact_1",
      kind: "trusted_contact",
      status: "active",
      firstName: "Sara",
      lastName: "Rahman",
      relationshipLabel: "Sister",
      email: "sara@example.com",
      phoneNumber: null,
      note: null,
      createdAt: "2026-04-22T10:00:00.000Z",
      updatedAt: "2026-04-22T10:00:00.000Z",
      removedAt: null,
    });

    const response = await request(app.getHttpServer())
      .post("/user/supabase_1/trusted-contacts")
      .set("Authorization", "Bearer test-token")
      .send({
        kind: "trusted_contact",
        firstName: "Sara",
        lastName: "Rahman",
        relationshipLabel: "Sister",
        email: "sara@example.com",
      })
      .expect(201);

    expect(userService.createTrustedContact).toHaveBeenCalledWith(
      "supabase_1",
      expect.objectContaining({
        firstName: "Sara",
        relationshipLabel: "Sister",
      }),
    );
    expect(response.body.data.trustedContact.id).toBe("contact_1");
  });

  it("removes trusted contacts through the controller", async () => {
    userService.removeTrustedContact.mockResolvedValue("contact_1");

    const response = await request(app.getHttpServer())
      .delete("/user/supabase_1/trusted-contacts/contact_1")
      .set("Authorization", "Bearer test-token")
      .expect(200);

    expect(userService.removeTrustedContact).toHaveBeenCalledWith(
      "supabase_1",
      "contact_1",
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Trusted contact removed successfully.",
      data: {
        removedTrustedContactId: "contact_1",
      },
    });
  });
});
