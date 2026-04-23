import { NotFoundException } from "@nestjs/common";
import { UserService } from "./user.service";

type LegacyUserProfile = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

describe("UserService.getUserById", () => {
  function createService(options: {
    legacyUser: LegacyUserProfile | null;
    customerProjectionResult?: unknown;
    customerProjectionError?: Error;
    walletProjectionResult?: unknown;
    walletProjectionError?: Error;
    customerFoundationResult?: unknown;
  }) {
    const prismaService = {
      user: {
        findFirst: jest.fn().mockResolvedValue(options.legacyUser),
      },
      customer: {
        findUnique: jest
          .fn()
          .mockResolvedValue(options.customerFoundationResult ?? null),
        update: jest.fn(),
      },
      customerTrustedContact: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const authService = {
      getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
      getCustomerWalletProjectionBySupabaseUserId: jest.fn(),
      getCurrentCustomerSessionSecurityStatus: jest.fn().mockResolvedValue({
        currentSessionTrusted: true,
        currentSessionRequiresVerification: false,
      }),
    };
    const notificationsService = {
      getCustomerPreferences: jest.fn().mockResolvedValue({
        audience: "customer",
        supportedChannels: ["in_app", "email"],
        updatedAt: null,
        entries: [
          {
            category: "security",
            channels: [
              { channel: "in_app", enabled: true, mandatory: true },
              { channel: "email", enabled: true, mandatory: true },
            ],
          },
          {
            category: "money_movement",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: true, mandatory: false },
            ],
          },
          {
            category: "yield",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: true, mandatory: false },
            ],
          },
          {
            category: "vault",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: true, mandatory: false },
            ],
          },
          {
            category: "loans",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: true, mandatory: false },
            ],
          },
          {
            category: "account",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: true, mandatory: false },
            ],
          },
          {
            category: "governance",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: false, mandatory: false },
            ],
          },
          {
            category: "operations",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: false, mandatory: false },
            ],
          },
          {
            category: "incident",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: false, mandatory: false },
            ],
          },
          {
            category: "product",
            channels: [
              { channel: "in_app", enabled: true, mandatory: false },
              { channel: "email", enabled: false, mandatory: false },
            ],
          },
        ],
      }),
    };

    if (options.customerProjectionError) {
      authService.getCustomerAccountProjectionBySupabaseUserId.mockRejectedValue(
        options.customerProjectionError,
      );
    } else {
      authService.getCustomerAccountProjectionBySupabaseUserId.mockResolvedValue(
        options.customerProjectionResult,
      );
    }

    if (options.walletProjectionError) {
      authService.getCustomerWalletProjectionBySupabaseUserId.mockRejectedValue(
        options.walletProjectionError,
      );
    } else {
      authService.getCustomerWalletProjectionBySupabaseUserId.mockResolvedValue(
        options.walletProjectionResult,
      );
    }

    const service = new UserService(
      authService as never,
      prismaService as never,
      notificationsService as never,
    );

    return {
      service,
      authService,
      prismaService,
      notificationsService,
    };
  }

  const legacyUser: LegacyUserProfile = {
    id: 7,
    firstName: "Legacy",
    lastName: "User",
    email: "legacy@example.com",
    supabaseUserId: "supabase_1",
    ethereumAddress: "0xlegacy",
  };

  const customerProjection = {
    customer: {
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "legacy@example.com",
      firstName: "Legacy",
      lastName: "User",
      passwordHash: "hashed",
      authTokenVersion: 0,
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaLastVerifiedAt: null,
      mfaLockedUntil: null,
      depositEmailNotificationsEnabled: true,
      withdrawalEmailNotificationsEnabled: true,
      loanEmailNotificationsEnabled: true,
      productUpdateEmailNotificationsEnabled: false,
      createdAt: new Date("2026-03-29T00:00:00.000Z"),
      updatedAt: new Date("2026-03-29T00:10:00.000Z"),
    },
    customerAccount: {
      id: "account_1",
      status: "registered",
      activatedAt: null,
      restrictedAt: null,
      frozenAt: null,
      closedAt: null,
      createdAt: new Date("2026-03-29T00:00:00.000Z"),
      updatedAt: new Date("2026-03-29T00:10:00.000Z"),
    },
  };

  const walletProjection = {
    wallet: {
      id: "wallet_1",
      customerAccountId: "account_1",
      chainId: 8453,
      address: "0xwallet",
      kind: "embedded",
      custodyType: "platform_managed",
      status: "active",
      createdAt: new Date("2026-03-29T00:00:00.000Z"),
      updatedAt: new Date("2026-03-29T00:10:00.000Z"),
    },
  };

  const customerFoundation = {
    id: "customer_1",
    dateOfBirth: new Date("1990-04-11T00:00:00.000Z"),
    ageVerificationStatus: "verified",
    ageVerifiedAt: new Date("2026-04-01T00:00:00.000Z"),
    ageVerifiedByOperatorId: "operator_1",
    ageVerificationNote: "Verified during KYC refresh.",
    trustedContacts: [
      {
        id: "contact_1",
        kind: "trusted_contact",
        status: "active",
        firstName: "Sara",
        lastName: "Rahman",
        relationshipLabel: "Sister",
        email: "sara@example.com",
        phoneNumber: "+15550001111",
        note: "Primary emergency contact",
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-11T00:00:00.000Z"),
        removedAt: null,
      },
    ],
  };

  it("uses wallet projection address before legacy ethereumAddress", async () => {
    const { service } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionResult: walletProjection,
      customerFoundationResult: customerFoundation,
    });

    const result = await service.getUserById("supabase_1");

    expect(result.ethereumAddress).toBe("0xwallet");
    expect(result.customerId).toBe("customer_1");
    expect(result.id).toBe(7);
    expect(result.passwordRotationAvailable).toBe(true);
    expect(result.notificationPreferences).toEqual(
      expect.objectContaining({
        audience: "customer",
        supportedChannels: ["in_app", "email"],
        entries: expect.any(Array),
      }),
    );
    expect(result.ageProfile).toEqual({
      dateOfBirth: "1990-04-11",
      ageYears: expect.any(Number),
      legalAdult: true,
      verificationStatus: "verified",
      verifiedAt: "2026-04-01T00:00:00.000Z",
      verifiedByOperatorId: "operator_1",
      verificationNote: "Verified during KYC refresh.",
    });
    expect(result.trustedContacts).toEqual([
      {
        id: "contact_1",
        kind: "trusted_contact",
        status: "active",
        firstName: "Sara",
        lastName: "Rahman",
        relationshipLabel: "Sister",
        email: "sara@example.com",
        phoneNumber: "+15550001111",
        note: "Primary emergency contact",
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-11T00:00:00.000Z",
        removedAt: null,
      },
    ]);
    expect(result.sessionSecurity).toEqual({
      currentSessionTrusted: true,
      currentSessionRequiresVerification: false,
    });
  });

  it("falls back to legacy ethereumAddress when wallet projection is missing", async () => {
    const { service } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionError: new NotFoundException(
        "Customer wallet projection not found.",
      ),
      customerFoundationResult: customerFoundation,
    });

    const result = await service.getUserById("supabase_1");

    expect(result.ethereumAddress).toBe("0xlegacy");
    expect(result.customerId).toBe("customer_1");
    expect(result.passwordRotationAvailable).toBe(true);
    expect(result.sessionSecurity).toEqual({
      currentSessionTrusted: true,
      currentSessionRequiresVerification: false,
    });
  });

  it("returns the legacy profile when the customer projection is missing", async () => {
    const { service } = createService({
      legacyUser,
      customerProjectionError: new NotFoundException(
        "Customer account not found.",
      ),
    });

    const result = await service.getUserById("supabase_1");

    expect(result).toEqual({
      id: 7,
      customerId: null,
      supabaseUserId: "supabase_1",
      email: "legacy@example.com",
      firstName: "Legacy",
      lastName: "User",
      ethereumAddress: "0xlegacy",
      accountStatus: null,
      activatedAt: null,
      restrictedAt: null,
      frozenAt: null,
      closedAt: null,
      passwordRotationAvailable: false,
      notificationPreferences: null,
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
  });

  it("throws when neither customer projection nor legacy profile exists", async () => {
    const { service } = createService({
      legacyUser: null,
      customerProjectionError: new NotFoundException(
        "Customer account not found.",
      ),
    });

    await expect(service.getUserById("missing_user")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates the customer age profile and resets verification when the DOB changes", async () => {
    const { service, prismaService } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionResult: walletProjection,
      customerFoundationResult: customerFoundation,
    });

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      dateOfBirth: new Date("1990-04-11T00:00:00.000Z"),
      ageVerificationStatus: "verified",
      ageVerifiedAt: new Date("2026-04-01T00:00:00.000Z"),
      ageVerifiedByOperatorId: "operator_1",
      ageVerificationNote: "Verified during KYC refresh.",
    });
    prismaService.customer.update.mockResolvedValue({
      dateOfBirth: new Date("1991-05-12T00:00:00.000Z"),
      ageVerificationStatus: "self_attested",
      ageVerifiedAt: null,
      ageVerifiedByOperatorId: null,
      ageVerificationNote: null,
    });

    const result = await service.updateAgeProfile("supabase_1", {
      dateOfBirth: "1991-05-12",
    });

    expect(prismaService.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        dateOfBirth: new Date("1991-05-12T00:00:00.000Z"),
        ageVerificationStatus: "self_attested",
        ageVerifiedAt: null,
        ageVerifiedByOperatorId: null,
        ageVerificationNote: null,
      },
      select: {
        dateOfBirth: true,
        ageVerificationStatus: true,
        ageVerifiedAt: true,
        ageVerifiedByOperatorId: true,
        ageVerificationNote: true,
      },
    });
    expect(result).toEqual({
      dateOfBirth: "1991-05-12",
      ageYears: expect.any(Number),
      legalAdult: true,
      verificationStatus: "self_attested",
      verifiedAt: null,
      verifiedByOperatorId: null,
      verificationNote: null,
    });
  });

  it("creates a trusted contact for the customer profile", async () => {
    const { service, prismaService } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionResult: walletProjection,
      customerFoundationResult: customerFoundation,
    });

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      dateOfBirth: null,
      ageVerificationStatus: "unverified",
      ageVerifiedAt: null,
      ageVerifiedByOperatorId: null,
      ageVerificationNote: null,
    });
    prismaService.customerTrustedContact.create.mockResolvedValue({
      id: "contact_2",
      kind: "beneficiary",
      status: "active",
      firstName: "Omar",
      lastName: "Rahman",
      relationshipLabel: "Brother",
      email: "omar@example.com",
      phoneNumber: null,
      note: null,
      createdAt: new Date("2026-04-22T10:00:00.000Z"),
      updatedAt: new Date("2026-04-22T10:00:00.000Z"),
      removedAt: null,
    });

    const result = await service.createTrustedContact("supabase_1", {
      kind: "beneficiary",
      firstName: " Omar ",
      lastName: "Rahman",
      relationshipLabel: "Brother",
      email: " omar@example.com ",
      note: "",
    });

    expect(prismaService.customerTrustedContact.create).toHaveBeenCalledWith({
      data: {
        customerId: "customer_1",
        kind: "beneficiary",
        firstName: "Omar",
        lastName: "Rahman",
        relationshipLabel: "Brother",
        email: "omar@example.com",
        phoneNumber: null,
        note: null,
      },
    });
    expect(result).toEqual({
      id: "contact_2",
      kind: "beneficiary",
      status: "active",
      firstName: "Omar",
      lastName: "Rahman",
      relationshipLabel: "Brother",
      email: "omar@example.com",
      phoneNumber: null,
      note: null,
      createdAt: "2026-04-22T10:00:00.000Z",
      updatedAt: "2026-04-22T10:00:00.000Z",
      removedAt: null,
    });
  });
});
