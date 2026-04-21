jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453,
  }),
  loadCustomerMfaPolicyRuntimeConfig: () => ({
    emailOtpExpirySeconds: 600,
    totpEnrollmentExpirySeconds: 900,
    stepUpFreshnessSeconds: 600,
    maxFailedAttempts: 3,
    lockoutSeconds: 900,
    challengeStartCooldownSeconds: 60,
    recoveryRequestAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "risk_manager",
    ],
    recoveryApproverAllowedOperatorRoles: ["risk_manager", "compliance_lead"],
    sessionRiskReadAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "risk_manager",
      "compliance_lead",
    ],
    sessionRiskRevokeAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager",
      "compliance_lead",
    ],
    sessionRiskEscalationAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager",
      "compliance_lead",
    ],
  }),
  loadJwtRuntimeConfig: () => ({
    jwtSecret: "test-secret",
    jwtExpirySeconds: 86400,
  }),
  loadSharedLoginBootstrapRuntimeConfig: () => ({
    enabled: true,
    email: "admin@gmail.com",
    password: "P@ssw0rd",
    firstName: "Shared",
    lastName: "Admin",
    supabaseUserId: "shared-login-admin",
  }),
}));

jest.mock("./auth.util", () => ({
  generateEthereumAddress: () => ({
    address: "0xgenerated",
  }),
}));

import * as bcrypt from "bcryptjs";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { createOtpHash } from "./customer-mfa.util";

jest.setTimeout(15000);

describe("AuthService", () => {
  function createService() {
    const transaction = {
      customer: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      customerAuthSession: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      customerMfaRecoveryRequest: {
        create: jest.fn(),
        update: jest.fn(),
      },
      customerAccount: {
        upsert: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      auditEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customerAuthSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      reviewCase: {
        findMany: jest.fn(),
      },
      customerMfaRecoveryRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      auditEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      customerAccount: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };

    const customerMfaEmailDeliveryService = {
      sendCode: jest.fn(),
    };
    const customerSecurityEmailDeliveryService = {
      sendSessionAlert: jest.fn().mockResolvedValue(undefined),
    };
    const reviewCasesService = {
      openOrReuseReviewCase: jest.fn(),
    };

    const service = new AuthService(
      prismaService as never,
      customerMfaEmailDeliveryService as never,
      customerSecurityEmailDeliveryService as never,
      reviewCasesService as never,
    );

    transaction.customerAuthSession.create.mockResolvedValue({
      id: "session_1",
    });
    transaction.customerAuthSession.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.customerAuthSession.update.mockResolvedValue(undefined);
    prismaService.customerAuthSession.create.mockResolvedValue({
      id: "session_1",
    });
    prismaService.customerAuthSession.findFirst.mockResolvedValue(null);
    prismaService.customerAuthSession.findUnique.mockResolvedValue(null);
    prismaService.customerAuthSession.findMany.mockResolvedValue([]);
    prismaService.customerAuthSession.groupBy.mockResolvedValue([]);
    prismaService.customerAuthSession.count.mockResolvedValue(0);
    prismaService.reviewCase.findMany.mockResolvedValue([]);
    prismaService.auditEvent.findMany.mockResolvedValue([]);
    prismaService.auditEvent.count.mockResolvedValue(0);
    prismaService.customerAuthSession.updateMany.mockResolvedValue({
      count: 1,
    });
    prismaService.customerAuthSession.update.mockResolvedValue(undefined);
    customerMfaEmailDeliveryService.sendCode.mockResolvedValue({
      deliveryChannel: "email",
      previewCode: "123456",
      backendType: "preview",
      backendReference: null,
    });

    return {
      service,
      prismaService,
      transaction,
      customerMfaEmailDeliveryService,
      customerSecurityEmailDeliveryService,
      reviewCasesService,
    };
  }

  it("returns the configured product-chain wallet projection", async () => {
    const { service, prismaService } = createService();
    const createdAt = new Date("2026-03-29T00:00:00.000Z");
    const updatedAt = new Date("2026-03-29T00:05:00.000Z");

    prismaService.customerAccount.findFirst.mockResolvedValue({
      wallets: [
        {
          id: "wallet_1",
          customerAccountId: "account_1",
          chainId: 8453,
          address: "0xwallet",
          kind: "embedded",
          custodyType: "platform_managed",
          status: "active",
          createdAt,
          updatedAt,
        },
      ],
    });

    const result =
      await service.getCustomerWalletProjectionBySupabaseUserId("supabase_1");

    expect(prismaService.customerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        customer: {
          supabaseUserId: "supabase_1",
        },
      },
      include: {
        wallets: {
          where: {
            chainId: 8453,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
        },
      },
    });

    expect(result).toEqual({
      wallet: {
        id: "wallet_1",
        customerAccountId: "account_1",
        chainId: 8453,
        address: "0xwallet",
        kind: "embedded",
        custodyType: "platform_managed",
        status: "active",
        createdAt,
        updatedAt,
      },
    });
  });

  it("throws when the customer account projection does not exist", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.getCustomerWalletProjectionBySupabaseUserId("missing_user"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws when the customer account exists but has no product-chain wallet", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      wallets: [],
    });

    await expect(
      service.getCustomerWalletProjectionBySupabaseUserId("supabase_1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("signs up without returning a private key", async () => {
    const { service, prismaService, transaction } = createService();

    prismaService.user.findUnique.mockResolvedValue(null);
    prismaService.user.create.mockResolvedValue(undefined);
    transaction.customer.upsert.mockResolvedValue({
      id: "customer_1",
    });
    transaction.customerAccount.upsert.mockResolvedValue({
      id: "account_1",
    });
    transaction.wallet.findUnique.mockResolvedValue(null);
    transaction.wallet.create.mockResolvedValue(undefined);

    const result = await service.signUp(
      "Ada",
      "Lovelace",
      "ada@example.com",
      "correct horse battery staple",
    );

    expect(result.status).toBe("success");
    expect(result.data?.user).toEqual({
      id: expect.any(String),
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      ethereumAddress: "0xgenerated",
    });
    expect(result.data?.user).not.toHaveProperty("privateKey");
  });

  it("logs in without returning a private key", async () => {
    const {
      service,
      prismaService,
      customerMfaEmailDeliveryService,
      customerSecurityEmailDeliveryService,
    } = createService();
    const passwordHash = await bcrypt.hash("s3cret-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      passwordHash,
      authTokenVersion: 0,
      mfaRequired: true,
      mfaTotpEnrolled: false,
      mfaEmailOtpEnrolled: false,
      mfaLastVerifiedAt: null,
      mfaLockedUntil: null,
    });
    prismaService.user.findFirst.mockResolvedValue({
      id: 42,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      supabaseUserId: "supabase_1",
      ethereumAddress: "0xgenerated",
    });
    prismaService.customerAuthSession.findFirst.mockResolvedValue(null);

    const result = await service.login("ada@example.com", "s3cret-pass", {
      clientPlatform: "web",
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
    });

    expect(result.status).toBe("success");
    expect(result.data?.token).toEqual(expect.any(String));
    expect(result.data?.user).toEqual({
      id: 42,
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      ethereumAddress: "0xgenerated",
      firstName: "Ada",
      lastName: "Lovelace",
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
        currentSessionTrusted: false,
        currentSessionRequiresVerification: true,
      },
    });
    expect(result.data?.user).not.toHaveProperty("privateKey");
    expect(
      customerSecurityEmailDeliveryService.sendSessionAlert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "new_session_login",
        clientPlatform: "web",
        userAgent: "Mozilla/5.0",
        ipAddress: "203.0.113.10",
      }),
    );
    expect(customerMfaEmailDeliveryService.sendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "session_trust_verification",
        challengeId: "session_1",
      }),
    );
  });

  it("does not send a new-session alert for a recognized device signature", async () => {
    const {
      service,
      prismaService,
      customerMfaEmailDeliveryService,
      customerSecurityEmailDeliveryService,
    } = createService();
    const passwordHash = await bcrypt.hash("s3cret-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      passwordHash,
      authTokenVersion: 0,
      mfaRequired: true,
      mfaTotpEnrolled: false,
      mfaEmailOtpEnrolled: false,
      mfaLastVerifiedAt: null,
      mfaLockedUntil: null,
    });
    prismaService.user.findFirst.mockResolvedValue({
      id: 42,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      supabaseUserId: "supabase_1",
      ethereumAddress: "0xgenerated",
    });
    prismaService.customerAuthSession.findFirst.mockResolvedValue({
      id: "session_existing",
    });

    await service.login("ada@example.com", "s3cret-pass", {
      clientPlatform: "web",
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
    });

    expect(
      customerSecurityEmailDeliveryService.sendSessionAlert,
    ).not.toHaveBeenCalled();
    expect(customerMfaEmailDeliveryService.sendCode).not.toHaveBeenCalled();
  });

  it("starts an email trust challenge for the current unfamiliar session", async () => {
    const { service, prismaService, customerMfaEmailDeliveryService } =
      createService();

    prismaService.customer.findUnique
      .mockResolvedValueOnce({
        id: "customer_1",
      })
      .mockResolvedValueOnce({
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
      });
    prismaService.customerAuthSession.findUnique.mockResolvedValue({
      id: "session_current",
      customerId: "customer_1",
      tokenVersion: 0,
      clientPlatform: "web",
      trustedAt: null,
      trustChallengeCodeHash: null,
      trustChallengeExpiresAt: null,
      trustChallengeSentAt: null,
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      lastSeenAt: new Date("2026-04-19T12:00:00.000Z"),
      revokedAt: null,
    });

    const result = await service.startCurrentSessionTrustChallenge(
      "supabase_1",
      {
        currentSessionId: "session_current",
        clientPlatform: "web",
        userAgent: "Mozilla/5.0",
        ipAddress: "203.0.113.10",
      },
    );

    expect(result.status).toBe("success");
    expect(result.data).toEqual({
      sessionSecurity: {
        currentSessionTrusted: false,
        currentSessionRequiresVerification: true,
      },
      expiresAt: expect.any(String),
      deliveryChannel: "email",
      previewCode: "123456",
    });
    expect(customerMfaEmailDeliveryService.sendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: "session_current",
        purpose: "session_trust_verification",
      }),
    );
  });

  it("verifies the current session trust code and marks the session trusted", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique
      .mockResolvedValueOnce({
        id: "customer_1",
      })
      .mockResolvedValueOnce({
        id: "customer_1",
        supabaseUserId: "supabase_1",
      });
    prismaService.customerAuthSession.findUnique.mockResolvedValue({
      id: "session_current",
      customerId: "customer_1",
      tokenVersion: 0,
      clientPlatform: "web",
      trustedAt: null,
      trustChallengeCodeHash: createOtpHash("123456"),
      trustChallengeExpiresAt: new Date(Date.now() + 60_000),
      trustChallengeSentAt: new Date(),
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      lastSeenAt: new Date("2026-04-19T12:00:00.000Z"),
      revokedAt: null,
    });
    prismaService.customerAuthSession.update.mockResolvedValue({
      id: "session_current",
      customerId: "customer_1",
      tokenVersion: 0,
      clientPlatform: "web",
      trustedAt: new Date("2026-04-19T12:05:00.000Z"),
      trustChallengeCodeHash: null,
      trustChallengeExpiresAt: null,
      trustChallengeSentAt: null,
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      lastSeenAt: new Date("2026-04-19T12:05:00.000Z"),
      revokedAt: null,
    });

    const result = await service.verifyCurrentSessionTrust(
      "supabase_1",
      "session_current",
      "123456",
    );

    expect(result.status).toBe("success");
    expect(result.data).toEqual({
      sessionSecurity: {
        currentSessionTrusted: true,
        currentSessionRequiresVerification: false,
      },
    });
    expect(prismaService.customerAuthSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session_current" },
        data: expect.objectContaining({
          trustChallengeCodeHash: null,
          trustChallengeExpiresAt: null,
          trustChallengeSentAt: null,
        }),
      }),
    );
  });

  it("bootstraps a shared login account idempotently", async () => {
    const { service, transaction } = createService();

    transaction.customer.findUnique.mockResolvedValue(null);
    transaction.customer.upsert.mockResolvedValue({
      id: "customer_shared",
    });
    transaction.customerAccount.upsert.mockResolvedValue({
      id: "account_shared",
    });
    transaction.user.findUnique.mockResolvedValue(null);
    transaction.user.upsert.mockResolvedValue({
      id: 7,
    });
    transaction.wallet.findUnique.mockResolvedValue(null);
    transaction.wallet.create.mockResolvedValue(undefined);

    const result = await service.ensureSharedLoginAccount();

    expect(transaction.customer.upsert).toHaveBeenCalledWith({
      where: { email: "admin@gmail.com" },
      update: {
        supabaseUserId: "shared-login-admin",
        email: "admin@gmail.com",
        firstName: "Shared",
        lastName: "Admin",
        passwordHash: expect.any(String),
      },
      create: {
        supabaseUserId: "shared-login-admin",
        email: "admin@gmail.com",
        firstName: "Shared",
        lastName: "Admin",
        passwordHash: expect.any(String),
      },
    });
    expect(transaction.user.upsert).toHaveBeenCalledWith({
      where: { email: "admin@gmail.com" },
      update: {
        firstName: "Shared",
        lastName: "Admin",
        email: "admin@gmail.com",
        supabaseUserId: "shared-login-admin",
        ethereumAddress: "0xgenerated",
      },
      create: {
        firstName: "Shared",
        lastName: "Admin",
        email: "admin@gmail.com",
        supabaseUserId: "shared-login-admin",
        ethereumAddress: "0xgenerated",
      },
    });
    expect(result).toEqual({
      customerId: "customer_shared",
      customerAccountId: "account_shared",
      supabaseUserId: "shared-login-admin",
      email: "admin@gmail.com",
      ethereumAddress: "0xgenerated",
      createdLegacyUser: true,
      createdCustomer: true,
      createdCustomerAccount: true,
    });
  });

  it("rotates the password and writes an audit event", async () => {
    const { service, prismaService, transaction } = createService();
    const passwordHash = await bcrypt.hash("current-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      passwordHash,
      authTokenVersion: 0,
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaLastVerifiedAt: new Date(),
      mfaLockedUntil: null,
    });
    transaction.customer.update.mockResolvedValue({
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      authTokenVersion: 1,
    });
    transaction.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.updatePassword(
      "supabase_1",
      "current-pass",
      "new-strong-pass",
    );

    expect(transaction.customer.update).toHaveBeenNthCalledWith(1, {
      where: { id: "customer_1" },
      data: {
        passwordHash: expect.any(String),
      },
    });
    expect(transaction.customer.update).toHaveBeenNthCalledWith(2, {
      where: { id: "customer_1" },
      data: {
        authTokenVersion: {
          increment: 1,
        },
      },
      select: {
        authTokenVersion: true,
      },
    });
    expect(transaction.customerAuthSession.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: "customer_1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: "password_rotation",
      },
    });
    expect(transaction.customerAuthSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer_1",
          tokenVersion: 1,
          clientPlatform: "unknown",
          trustedAt: expect.any(Date),
        }),
        select: {
          id: true,
        },
      }),
    );
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: {
        customerId: "customer_1",
        actorType: "customer",
        actorId: "supabase_1",
        action: "customer_account.password_rotated",
        targetType: "Customer",
        targetId: "customer_1",
        metadata: {
          passwordRotationAvailable: true,
          revokedOtherSessions: true,
        },
      },
    });
    expect(result).toEqual({
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true,
        session: {
          token: expect.any(String),
          revokedOtherSessions: true,
        },
      },
    });
  });

  it("rejects password rotation when the current password is incorrect", async () => {
    const { service, prismaService } = createService();
    const passwordHash = await bcrypt.hash("current-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      passwordHash,
      authTokenVersion: 0,
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaLastVerifiedAt: new Date(),
      mfaLockedUntil: null,
    });

    await expect(
      service.updatePassword("supabase_1", "wrong-pass", "new-strong-pass"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects password rotation when the new password matches the current password", async () => {
    const { service } = createService();

    await expect(
      service.updatePassword("supabase_1", "same-pass", "same-pass"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects password rotation when no customer password exists", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      mfaRequired: true,
      mfaTotpEnrolled: false,
      mfaEmailOtpEnrolled: false,
      mfaLastVerifiedAt: null,
      mfaLockedUntil: null,
      authTokenVersion: 0,
      passwordHash: null,
    });

    await expect(
      service.updatePassword("supabase_1", "current-pass", "new-strong-pass"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks MFA challenge starts during cooldown", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaTotpSecret: "ABCDEFGHIJKLMNOP",
      mfaPendingTotpSecret: null,
      mfaPendingTotpIssuedAt: null,
      mfaActiveChallenge: null,
      mfaLastVerifiedAt: null,
      mfaFailedAttemptCount: 0,
      mfaLockedUntil: null,
      mfaLastChallengeStartedAt: new Date(),
    });

    await expect(
      service.startMfaChallenge("supabase_1", "withdrawal_step_up", "totp"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("starts email enrollment through the delivery service", async () => {
    const { service, prismaService, customerMfaEmailDeliveryService } =
      createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: false,
      mfaTotpSecret: "ABCDEFGHIJKLMNOP",
      mfaPendingTotpSecret: null,
      mfaPendingTotpIssuedAt: null,
      mfaActiveChallenge: null,
      mfaLastVerifiedAt: null,
      mfaFailedAttemptCount: 0,
      mfaLockedUntil: null,
      mfaLastChallengeStartedAt: null,
    });
    prismaService.customer.update.mockResolvedValue(undefined);
    prismaService.auditEvent.create.mockResolvedValue(undefined);
    customerMfaEmailDeliveryService.sendCode.mockResolvedValue({
      deliveryChannel: "email",
      previewCode: "123456",
      backendType: "preview",
      backendReference: null,
    });

    const result = await service.startEmailEnrollment("supabase_1");

    expect(customerMfaEmailDeliveryService.sendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer_1",
        actorId: "supabase_1",
        email: "ada@example.com",
        purpose: "email_enrollment",
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        deliveryChannel: "email",
        previewCode: "123456",
      }),
    );
  });

  it("locks MFA after repeated invalid email verification codes", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: false,
      mfaTotpSecret: "ABCDEFGHIJKLMNOP",
      mfaPendingTotpSecret: null,
      mfaPendingTotpIssuedAt: null,
      mfaActiveChallenge: {
        id: "challenge_1",
        purpose: "email_enrollment",
        method: "email_otp",
        codeHash:
          "4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        sentAt: new Date().toISOString(),
      },
      mfaLastVerifiedAt: null,
      mfaFailedAttemptCount: 2,
      mfaLockedUntil: null,
      mfaLastChallengeStartedAt: null,
    });
    prismaService.customer.update.mockResolvedValue(undefined);

    await expect(
      service.verifyEmailEnrollment("supabase_1", "challenge_1", "000000"),
    ).rejects.toThrow(/locked until/i);

    expect(prismaService.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: expect.any(Date),
      },
    });
  });

  it("starts customer email recovery through the delivery service", async () => {
    const { service, prismaService, customerMfaEmailDeliveryService } =
      createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaTotpSecret: "ABCDEFGHIJKLMNOP",
      mfaPendingTotpSecret: null,
      mfaPendingTotpIssuedAt: null,
      mfaActiveChallenge: null,
      mfaLastVerifiedAt: null,
      mfaFailedAttemptCount: 0,
      mfaLockedUntil: null,
      mfaLastChallengeStartedAt: null,
    });
    prismaService.customer.update.mockResolvedValue(undefined);
    prismaService.auditEvent.create.mockResolvedValue(undefined);
    customerMfaEmailDeliveryService.sendCode.mockResolvedValue({
      deliveryChannel: "email",
      previewCode: "123456",
      backendType: "preview",
      backendReference: null,
    });

    const result = await service.startEmailRecovery("supabase_1");

    expect(customerMfaEmailDeliveryService.sendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer_1",
        actorId: "supabase_1",
        email: "ada@example.com",
        purpose: "email_recovery",
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        deliveryChannel: "email",
        previewCode: "123456",
      }),
    );
  });

  it("verifies customer email recovery and rotates the customer session", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaTotpSecret: "ABCDEFGHIJKLMNOP",
      mfaPendingTotpSecret: null,
      mfaPendingTotpIssuedAt: null,
      mfaActiveChallenge: {
        id: "challenge_1",
        purpose: "email_recovery",
        method: "email_otp",
        codeHash:
          "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        sentAt: new Date().toISOString(),
      },
      mfaLastVerifiedAt: new Date(),
      mfaFailedAttemptCount: 0,
      mfaLockedUntil: null,
      mfaLastChallengeStartedAt: null,
    });
    prismaService.customer.update.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      authTokenVersion: 4,
      mfaRequired: true,
      mfaTotpEnrolled: false,
      mfaEmailOtpEnrolled: true,
      mfaLastVerifiedAt: null,
      mfaLockedUntil: null,
    });
    prismaService.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.verifyEmailRecovery(
      "supabase_1",
      "challenge_1",
      "123456",
    );

    expect(prismaService.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: expect.objectContaining({
        mfaTotpEnrolled: false,
        mfaTotpSecret: null,
        mfaPendingTotpSecret: null,
        mfaPendingTotpIssuedAt: null,
        mfaLastVerifiedAt: null,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
        authTokenVersion: {
          increment: 1,
        },
      }),
      select: expect.objectContaining({
        id: true,
        supabaseUserId: true,
        email: true,
        authTokenVersion: true,
      }),
    });
    expect(prismaService.customerAuthSession.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: "customer_1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: "mfa_recovery",
      },
    });
    expect(result.data?.session).toEqual({
      token: expect.any(String),
      revokedOtherSessions: true,
    });
  });

  it("creates a governed customer MFA recovery request", async () => {
    const { service, prismaService, transaction } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      mfaRequired: true,
      mfaTotpEnrolled: true,
      mfaEmailOtpEnrolled: true,
      mfaTotpSecret: "ABCDEFGHIJKLMNOP",
      mfaPendingTotpSecret: null,
      mfaPendingTotpIssuedAt: null,
      mfaActiveChallenge: null,
      mfaLastVerifiedAt: null,
      mfaFailedAttemptCount: 0,
      mfaLockedUntil: new Date(Date.now() + 60_000),
      mfaLastChallengeStartedAt: null,
      accounts: [
        {
          id: "account_1",
          status: "active",
        },
      ],
    });
    prismaService.customerMfaRecoveryRequest.findFirst.mockResolvedValue(null);
    transaction.customerMfaRecoveryRequest.create.mockResolvedValue({
      id: "recovery_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      requestType: "release_lockout",
      status: "pending_approval",
      requestedByOperatorId: "ops_1",
      requestedByOperatorRole: "operations_admin",
      requestNote: "Identity verified.",
      requestedAt: new Date("2026-04-19T18:00:00.000Z"),
      approvedByOperatorId: null,
      approvedByOperatorRole: null,
      approvalNote: null,
      approvedAt: null,
      rejectedByOperatorId: null,
      rejectedByOperatorRole: null,
      rejectionNote: null,
      rejectedAt: null,
      executedByOperatorId: null,
      executedByOperatorRole: null,
      executionNote: null,
      executedAt: null,
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      customerAccount: {
        id: "account_1",
        status: "active",
      },
    });
    transaction.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.requestCustomerMfaRecovery(
      "supabase_1",
      "ops_1",
      "operations_admin",
      {
        requestType: "release_lockout",
        note: "Identity verified.",
      },
    );

    expect(transaction.customerMfaRecoveryRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer_1",
          customerAccountId: "account_1",
          requestType: "release_lockout",
          requestedByOperatorId: "ops_1",
          requestedByOperatorRole: "operations_admin",
        }),
      }),
    );
    expect(result.request.id).toBe("recovery_1");
    expect(result.stateReused).toBe(false);
  });

  it("blocks self-approval for a customer MFA recovery request", async () => {
    const { service, prismaService } = createService();

    prismaService.customerMfaRecoveryRequest.findUnique.mockResolvedValue({
      id: "recovery_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      requestType: "release_lockout",
      status: "pending_approval",
      requestedByOperatorId: "ops_1",
      requestedByOperatorRole: "operations_admin",
      requestNote: "Identity verified.",
      requestedAt: new Date("2026-04-19T18:00:00.000Z"),
      approvedByOperatorId: null,
      approvedByOperatorRole: null,
      approvalNote: null,
      approvedAt: null,
      rejectedByOperatorId: null,
      rejectedByOperatorRole: null,
      rejectionNote: null,
      rejectedAt: null,
      executedByOperatorId: null,
      executedByOperatorRole: null,
      executionNote: null,
      executedAt: null,
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      customerAccount: {
        id: "account_1",
        status: "active",
      },
    });

    await expect(
      service.approveCustomerMfaRecoveryRequest(
        "recovery_1",
        "ops_1",
        "risk_manager",
        "Approved",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("executes an approved customer MFA reset with session invalidation", async () => {
    const { service, prismaService, transaction } = createService();

    prismaService.customerMfaRecoveryRequest.findUnique.mockResolvedValue({
      id: "recovery_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      requestType: "reset_mfa",
      status: "approved",
      requestedByOperatorId: "ops_1",
      requestedByOperatorRole: "operations_admin",
      requestNote: "Device lost.",
      requestedAt: new Date("2026-04-19T18:00:00.000Z"),
      approvedByOperatorId: "ops_2",
      approvedByOperatorRole: "risk_manager",
      approvalNote: "Approved after KYC review.",
      approvedAt: new Date("2026-04-19T18:10:00.000Z"),
      rejectedByOperatorId: null,
      rejectedByOperatorRole: null,
      rejectionNote: null,
      rejectedAt: null,
      executedByOperatorId: null,
      executedByOperatorRole: null,
      executionNote: null,
      executedAt: null,
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      customerAccount: {
        id: "account_1",
        status: "active",
      },
    });
    transaction.customer.update.mockResolvedValue(undefined);
    transaction.customerMfaRecoveryRequest.update.mockResolvedValue({
      id: "recovery_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      requestType: "reset_mfa",
      status: "executed",
      requestedByOperatorId: "ops_1",
      requestedByOperatorRole: "operations_admin",
      requestNote: "Device lost.",
      requestedAt: new Date("2026-04-19T18:00:00.000Z"),
      approvedByOperatorId: "ops_2",
      approvedByOperatorRole: "risk_manager",
      approvalNote: "Approved after KYC review.",
      approvedAt: new Date("2026-04-19T18:10:00.000Z"),
      rejectedByOperatorId: null,
      rejectedByOperatorRole: null,
      rejectionNote: null,
      rejectedAt: null,
      executedByOperatorId: "ops_3",
      executedByOperatorRole: "operations_admin",
      executionNote: "Executed for customer support recovery.",
      executedAt: new Date("2026-04-19T18:11:00.000Z"),
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      customerAccount: {
        id: "account_1",
        status: "active",
      },
    });
    transaction.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.executeCustomerMfaRecoveryRequest(
      "recovery_1",
      "ops_3",
      "operations_admin",
      "Executed for customer support recovery.",
    );

    expect(transaction.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        mfaTotpEnrolled: false,
        mfaEmailOtpEnrolled: false,
        mfaTotpSecret: null,
        mfaPendingTotpSecret: null,
        mfaPendingTotpIssuedAt: null,
        mfaActiveChallenge: expect.anything(),
        mfaLastVerifiedAt: null,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
        mfaLastChallengeStartedAt: null,
        authTokenVersion: {
          increment: 1,
        },
      },
    });
    expect(result.request.status).toBe("executed");
    expect(result.stateReused).toBe(false);
  });

  it("lists active untrusted customer session risks with challenge posture summary", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAuthSession.findMany.mockResolvedValue([
      {
        id: "session_risk_1",
        clientPlatform: "web",
        trustedAt: null,
        trustChallengeCodeHash: createOtpHash("123456"),
        trustChallengeExpiresAt: new Date(Date.now() - 60_000),
        trustChallengeSentAt: new Date(Date.now() - 120_000),
        userAgent: "Mozilla/5.0",
        ipAddress: "203.0.113.10",
        createdAt: new Date("2026-04-20T09:55:00.000Z"),
        lastSeenAt: new Date("2026-04-20T10:01:00.000Z"),
        revokedAt: null,
        customerId: "customer_1",
        customer: {
          id: "customer_1",
          supabaseUserId: "supabase_1",
          email: "ada@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          accounts: [
            {
              id: "account_1",
              status: "active",
            },
          ],
        },
      },
    ]);
    prismaService.customerAuthSession.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prismaService.customerAuthSession.groupBy
      .mockResolvedValueOnce([
        {
          customerId: "customer_1",
          _count: {
            _all: 4,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          customerId: "customer_1",
          _count: {
            _all: 2,
          },
        },
      ]);
    prismaService.reviewCase.findMany.mockResolvedValue([
      {
        id: "review_case_1",
        customerAccountId: "account_1",
        type: "account_review",
        status: "open",
        assignedOperatorId: "ops_2",
        updatedAt: new Date("2026-04-20T10:02:00.000Z"),
      },
    ]);

    const result = await service.listCustomerSessionRisks(
      {
        limit: 10,
      },
      "operations_admin",
    );

    expect(prismaService.customerAuthSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          revokedAt: null,
          trustedAt: null,
        },
        take: 10,
      }),
    );
    expect(result).toEqual({
      sessions: [
        expect.objectContaining({
          id: "session_risk_1",
          clientPlatform: "web",
          challengeState: "expired",
          riskSeverity: "critical",
          recommendedAction: "open_review_case",
          riskReasons: expect.arrayContaining([
            "expired_trust_challenge",
            "multiple_untrusted_sessions",
            "high_active_session_count",
          ]),
          linkedReviewCase: expect.objectContaining({
            reviewCaseId: "review_case_1",
          }),
          customer: expect.objectContaining({
            email: "ada@example.com",
            customerAccountId: "account_1",
          }),
        }),
      ],
      limit: 10,
      totalCount: 3,
      summary: {
        byChallengeState: [
          {
            challengeState: "pending",
            count: 1,
          },
          {
            challengeState: "expired",
            count: 1,
          },
          {
            challengeState: "not_started",
            count: 1,
          },
        ],
        byPlatform: [
          {
            clientPlatform: "web",
            count: 2,
          },
          {
            clientPlatform: "mobile",
            count: 1,
          },
          {
            clientPlatform: "unknown",
            count: 0,
          },
        ],
        bySeverity: [
          {
            riskSeverity: "critical",
            count: 1,
          },
          {
            riskSeverity: "warning",
            count: 0,
          },
        ],
      },
    });
  });

  it("allows an authorized operator to revoke an active risky customer session", async () => {
    const { service, prismaService, transaction } = createService();

    prismaService.customerAuthSession.findUnique.mockResolvedValue({
      id: "session_risk_1",
      clientPlatform: "web",
      trustedAt: null,
      trustChallengeCodeHash: createOtpHash("123456"),
      trustChallengeExpiresAt: new Date(Date.now() - 60_000),
      trustChallengeSentAt: new Date(Date.now() - 120_000),
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
      createdAt: new Date("2026-04-20T09:55:00.000Z"),
      lastSeenAt: new Date("2026-04-20T10:01:00.000Z"),
      revokedAt: null,
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        accounts: [
          {
            id: "account_1",
            status: "active",
          },
        ],
      },
    });
    transaction.customerAuthSession.update.mockResolvedValue({
      id: "session_risk_1",
      clientPlatform: "web",
      trustedAt: null,
      trustChallengeCodeHash: createOtpHash("123456"),
      trustChallengeExpiresAt: new Date(Date.now() - 60_000),
      trustChallengeSentAt: new Date(Date.now() - 120_000),
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
      createdAt: new Date("2026-04-20T09:55:00.000Z"),
      lastSeenAt: new Date("2026-04-20T10:01:00.000Z"),
      revokedAt: new Date("2026-04-20T10:02:00.000Z"),
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        accounts: [
          {
            id: "account_1",
            status: "active",
          },
        ],
      },
    });
    transaction.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.revokeCustomerSessionRisk(
      "session_risk_1",
      "ops_1",
      "risk_manager",
      "Customer reported unfamiliar access.",
    );

    expect(transaction.customerAuthSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session_risk_1" },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedReason: "session_revoked",
        }),
      }),
    );
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "operator",
          actorId: "ops_1",
          action: "customer_account.session_revoked",
          targetType: "CustomerAuthSession",
          targetId: "session_risk_1",
        }),
      }),
    );
    expect(result).toEqual({
      session: expect.objectContaining({
        id: "session_risk_1",
        revokedAt: "2026-04-20T10:02:00.000Z",
        riskSeverity: "warning",
      }),
      stateReused: false,
    });
  });

  it("escalates a risky customer session into an account review case", async () => {
    const { service, prismaService, reviewCasesService } = createService();

    prismaService.customerAuthSession.findUnique.mockResolvedValue({
      id: "session_risk_1",
      clientPlatform: "unknown",
      trustedAt: null,
      trustChallengeCodeHash: createOtpHash("123456"),
      trustChallengeExpiresAt: new Date(Date.now() - 60_000),
      trustChallengeSentAt: new Date(Date.now() - 120_000),
      userAgent: null,
      ipAddress: "203.0.113.10",
      createdAt: new Date("2026-04-20T09:55:00.000Z"),
      lastSeenAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        accounts: [
          {
            id: "account_1",
            status: "active",
          },
        ],
      },
    });
    prismaService.customerAuthSession.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    reviewCasesService.openOrReuseReviewCase.mockResolvedValue({
      reviewCase: {
        id: "review_case_1",
        type: "account_review",
        status: "open",
        reasonCode: "session_risk_anomaly",
        assignedOperatorId: null,
        updatedAt: "2026-04-20T10:05:00.000Z",
      },
      reviewCaseReused: false,
    });
    prismaService.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.escalateCustomerSessionRisk(
      "session_risk_1",
      "ops_1",
      "risk_manager",
      "Escalating due to repeated unfamiliar access.",
    );

    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalledWith(
      prismaService,
      expect.objectContaining({
        customerId: "customer_1",
        customerAccountId: "account_1",
        type: "account_review",
        reasonCode: "session_risk_anomaly",
      }),
    );
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "customer_account.session_risk_escalated",
          targetId: "session_risk_1",
        }),
      }),
    );
    expect(result).toEqual({
      session: expect.objectContaining({
        id: "session_risk_1",
        linkedReviewCase: expect.objectContaining({
          reviewCaseId: "review_case_1",
        }),
        riskSeverity: "critical",
      }),
      reviewCase: {
        id: "review_case_1",
        type: "account_review",
        status: "open",
        reasonCode: "session_risk_anomaly",
        assignedOperatorId: null,
        updatedAt: "2026-04-20T10:05:00.000Z",
      },
      reviewCaseReused: false,
    });
  });

  it("revokes all customer sessions and returns a fresh token", async () => {
    const { service, prismaService, transaction } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
    });
    transaction.customer.update.mockResolvedValue({
      authTokenVersion: 3,
    });
    prismaService.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.revokeAllCustomerSessions("supabase_1");

    expect(transaction.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        authTokenVersion: {
          increment: 1,
        },
      },
      select: {
        authTokenVersion: true,
      },
    });
    expect(transaction.customerAuthSession.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: "customer_1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: "revoke_all",
      },
    });
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "customer_account.sessions_revoked",
        }),
      }),
    );
    expect(result.data?.session).toEqual({
      token: expect.any(String),
      revokedOtherSessions: true,
    });
  });

  it("lists normalized customer security activity", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
    });
    prismaService.auditEvent.findMany.mockResolvedValue([
      {
        id: "audit_login",
        action: "customer_account.session_created",
        metadata: {
          clientPlatform: "web",
          ipAddress: "203.0.113.10",
          userAgent: "Mozilla/5.0",
        },
        createdAt: new Date("2026-04-19T10:00:00.000Z"),
      },
      {
        id: "audit_mfa",
        action: "customer_account.mfa_challenge_verified",
        metadata: {
          purpose: "withdrawal_step_up",
          method: "totp",
        },
        createdAt: new Date("2026-04-19T09:00:00.000Z"),
      },
    ]);
    prismaService.auditEvent.count.mockResolvedValue(2);

    const result = await service.listCustomerSecurityActivity("supabase_1");

    expect(result.data).toEqual({
      events: [
        {
          id: "audit_login",
          kind: "login",
          createdAt: "2026-04-19T10:00:00.000Z",
          clientPlatform: "web",
          ipAddress: "203.0.113.10",
          userAgent: "Mozilla/5.0",
          purpose: null,
          method: null,
        },
        {
          id: "audit_mfa",
          kind: "mfa_step_up_verified",
          createdAt: "2026-04-19T09:00:00.000Z",
          clientPlatform: null,
          ipAddress: null,
          userAgent: null,
          purpose: "withdrawal_step_up",
          method: "totp",
        },
      ],
      limit: 20,
      totalCount: 2,
    });
  });
});
