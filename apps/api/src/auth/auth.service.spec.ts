jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadJwtRuntimeConfig: () => ({
    jwtSecret: "test-secret",
    jwtExpirySeconds: 86400
  }),
  loadSharedLoginBootstrapRuntimeConfig: () => ({
    enabled: true,
    email: "admin@gmail.com",
    password: "P@ssw0rd",
    firstName: "Shared",
    lastName: "Admin",
    supabaseUserId: "shared-login-admin"
  })
}));

jest.mock("./auth.util", () => ({
  generateEthereumAddress: () => ({
    address: "0xgenerated"
  })
}));

import * as bcrypt from "bcryptjs";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  function createService() {
    const transaction = {
      customer: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn()
      },
      customerAccount: {
        upsert: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn()
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn()
      },
      auditEvent: {
        create: jest.fn()
      }
    };

    const prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn()
      },
      customer: {
        findUnique: jest.fn()
      },
      customerAccount: {
        findFirst: jest.fn()
      },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction)
      )
    };

    const service = new AuthService(prismaService as never);

    return {
      service,
      prismaService,
      transaction
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
          updatedAt
        }
      ]
    });

    const result =
      await service.getCustomerWalletProjectionBySupabaseUserId("supabase_1");

    expect(prismaService.customerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        customer: {
          supabaseUserId: "supabase_1"
        }
      },
      include: {
        wallets: {
          where: {
            chainId: 8453
          },
          orderBy: {
            createdAt: "asc"
          },
          take: 1
        }
      }
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
        updatedAt
      }
    });
  });

  it("throws when the customer account projection does not exist", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.getCustomerWalletProjectionBySupabaseUserId("missing_user")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws when the customer account exists but has no product-chain wallet", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      wallets: []
    });

    await expect(
      service.getCustomerWalletProjectionBySupabaseUserId("supabase_1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("signs up without returning a private key", async () => {
    const { service, prismaService, transaction } = createService();

    prismaService.user.findUnique.mockResolvedValue(null);
    prismaService.user.create.mockResolvedValue(undefined);
    transaction.customer.upsert.mockResolvedValue({
      id: "customer_1"
    });
    transaction.customerAccount.upsert.mockResolvedValue({
      id: "account_1"
    });
    transaction.wallet.findUnique.mockResolvedValue(null);
    transaction.wallet.create.mockResolvedValue(undefined);

    const result = await service.signUp(
      "Ada",
      "Lovelace",
      "ada@example.com",
      "correct horse battery staple"
    );

    expect(result.status).toBe("success");
    expect(result.data?.user).toEqual({
      id: expect.any(String),
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      ethereumAddress: "0xgenerated"
    });
    expect(result.data?.user).not.toHaveProperty("privateKey");
  });

  it("logs in without returning a private key", async () => {
    const { service, prismaService } = createService();
    const passwordHash = await bcrypt.hash("s3cret-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      passwordHash
    });
    prismaService.user.findFirst.mockResolvedValue({
      id: 42,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      supabaseUserId: "supabase_1",
      ethereumAddress: "0xgenerated"
    });

    const result = await service.login("ada@example.com", "s3cret-pass");

    expect(result.status).toBe("success");
    expect(result.data?.token).toEqual(expect.any(String));
    expect(result.data?.user).toEqual({
      id: 42,
      supabaseUserId: "supabase_1",
      email: "ada@example.com",
      ethereumAddress: "0xgenerated",
      firstName: "Ada",
      lastName: "Lovelace"
    });
    expect(result.data?.user).not.toHaveProperty("privateKey");
  });

  it("bootstraps a shared login account idempotently", async () => {
    const { service, transaction } = createService();

    transaction.customer.findUnique.mockResolvedValue(null);
    transaction.customer.upsert.mockResolvedValue({
      id: "customer_shared"
    });
    transaction.customerAccount.upsert.mockResolvedValue({
      id: "account_shared"
    });
    transaction.user.findUnique.mockResolvedValue(null);
    transaction.user.upsert.mockResolvedValue({
      id: 7
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
        passwordHash: expect.any(String)
      },
      create: {
        supabaseUserId: "shared-login-admin",
        email: "admin@gmail.com",
        firstName: "Shared",
        lastName: "Admin",
        passwordHash: expect.any(String)
      }
    });
    expect(transaction.user.upsert).toHaveBeenCalledWith({
      where: { email: "admin@gmail.com" },
      update: {
        firstName: "Shared",
        lastName: "Admin",
        email: "admin@gmail.com",
        supabaseUserId: "shared-login-admin",
        ethereumAddress: "0xgenerated"
      },
      create: {
        firstName: "Shared",
        lastName: "Admin",
        email: "admin@gmail.com",
        supabaseUserId: "shared-login-admin",
        ethereumAddress: "0xgenerated"
      }
    });
    expect(result).toEqual({
      customerId: "customer_shared",
      customerAccountId: "account_shared",
      supabaseUserId: "shared-login-admin",
      email: "admin@gmail.com",
      ethereumAddress: "0xgenerated",
      createdLegacyUser: true,
      createdCustomer: true,
      createdCustomerAccount: true
    });
  });

  it("rotates the password and writes an audit event", async () => {
    const { service, prismaService, transaction } = createService();
    const passwordHash = await bcrypt.hash("current-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      passwordHash
    });
    transaction.customer.update.mockResolvedValue(undefined);
    transaction.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.updatePassword(
      "supabase_1",
      "current-pass",
      "new-strong-pass"
    );

    expect(transaction.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        passwordHash: expect.any(String)
      }
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: {
        customerId: "customer_1",
        actorType: "customer",
        actorId: "supabase_1",
        action: "customer_account.password_rotated",
        targetType: "Customer",
        targetId: "customer_1",
        metadata: {
          passwordRotationAvailable: true
        }
      }
    });
    expect(result).toEqual({
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true
      }
    });
  });

  it("rejects password rotation when the current password is incorrect", async () => {
    const { service, prismaService } = createService();
    const passwordHash = await bcrypt.hash("current-pass", 4);

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      passwordHash
    });

    await expect(
      service.updatePassword("supabase_1", "wrong-pass", "new-strong-pass")
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects password rotation when the new password matches the current password", async () => {
    const { service } = createService();

    await expect(
      service.updatePassword("supabase_1", "same-pass", "same-pass")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects password rotation when no customer password exists", async () => {
    const { service, prismaService } = createService();

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      supabaseUserId: "supabase_1",
      passwordHash: null
    });

    await expect(
      service.updatePassword("supabase_1", "current-pass", "new-strong-pass")
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
