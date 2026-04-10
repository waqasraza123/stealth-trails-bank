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
  }) {
    const prismaService = {
      user: {
        findFirst: jest.fn().mockResolvedValue(options.legacyUser)
      },
      customer: {
        findUnique: jest.fn(),
        update: jest.fn()
      }
    };

    const authService = {
      getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
      getCustomerWalletProjectionBySupabaseUserId: jest.fn()
    };

    if (options.customerProjectionError) {
      authService.getCustomerAccountProjectionBySupabaseUserId.mockRejectedValue(
        options.customerProjectionError
      );
    } else {
      authService.getCustomerAccountProjectionBySupabaseUserId.mockResolvedValue(
        options.customerProjectionResult
      );
    }

    if (options.walletProjectionError) {
      authService.getCustomerWalletProjectionBySupabaseUserId.mockRejectedValue(
        options.walletProjectionError
      );
    } else {
      authService.getCustomerWalletProjectionBySupabaseUserId.mockResolvedValue(
        options.walletProjectionResult
      );
    }

    const service = new UserService(
      authService as never,
      prismaService as never
    );

    return {
      service,
      authService,
      prismaService
    };
  }

  const legacyUser: LegacyUserProfile = {
    id: 7,
    firstName: "Legacy",
    lastName: "User",
    email: "legacy@example.com",
    supabaseUserId: "supabase_1",
    ethereumAddress: "0xlegacy"
  };

  const customerProjection = {
    customer: {
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "legacy@example.com",
      firstName: "Legacy",
      lastName: "User",
      passwordHash: "hashed",
      depositEmailNotificationsEnabled: true,
      withdrawalEmailNotificationsEnabled: true,
      loanEmailNotificationsEnabled: true,
      productUpdateEmailNotificationsEnabled: false,
      createdAt: new Date("2026-03-29T00:00:00.000Z"),
      updatedAt: new Date("2026-03-29T00:10:00.000Z")
    },
    customerAccount: {
      id: "account_1",
      status: "registered",
      activatedAt: null,
      restrictedAt: null,
      frozenAt: null,
      closedAt: null,
      createdAt: new Date("2026-03-29T00:00:00.000Z"),
      updatedAt: new Date("2026-03-29T00:10:00.000Z")
    }
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
      updatedAt: new Date("2026-03-29T00:10:00.000Z")
    }
  };

  it("uses wallet projection address before legacy ethereumAddress", async () => {
    const { service } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionResult: walletProjection
    });

    const result = await service.getUserById("supabase_1");

    expect(result.ethereumAddress).toBe("0xwallet");
    expect(result.customerId).toBe("customer_1");
    expect(result.id).toBe(7);
    expect(result.passwordRotationAvailable).toBe(true);
    expect(result.notificationPreferences).toEqual({
      depositEmails: true,
      withdrawalEmails: true,
      loanEmails: true,
      productUpdateEmails: false
    });
  });

  it("falls back to legacy ethereumAddress when wallet projection is missing", async () => {
    const { service } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionError: new NotFoundException(
        "Customer wallet projection not found."
      )
    });

    const result = await service.getUserById("supabase_1");

    expect(result.ethereumAddress).toBe("0xlegacy");
    expect(result.customerId).toBe("customer_1");
    expect(result.passwordRotationAvailable).toBe(true);
  });

  it("returns the legacy profile when the customer projection is missing", async () => {
    const { service } = createService({
      legacyUser,
      customerProjectionError: new NotFoundException(
        "Customer account not found."
      )
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
      notificationPreferences: null
    });
  });

  it("throws when neither customer projection nor legacy profile exists", async () => {
    const { service } = createService({
      legacyUser: null,
      customerProjectionError: new NotFoundException(
        "Customer account not found."
      )
    });

    await expect(service.getUserById("missing_user")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("updates customer notification preferences", async () => {
    const { service, prismaService } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionResult: walletProjection
    });

    prismaService.customer.findUnique.mockResolvedValue({
      id: "customer_1"
    });
    prismaService.customer.update.mockResolvedValue({
      depositEmailNotificationsEnabled: false,
      withdrawalEmailNotificationsEnabled: true,
      loanEmailNotificationsEnabled: false,
      productUpdateEmailNotificationsEnabled: true
    });

    const result = await service.updateNotificationPreferences("supabase_1", {
      depositEmails: false,
      withdrawalEmails: true,
      loanEmails: false,
      productUpdateEmails: true
    });

    expect(prismaService.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        depositEmailNotificationsEnabled: false,
        withdrawalEmailNotificationsEnabled: true,
        loanEmailNotificationsEnabled: false,
        productUpdateEmailNotificationsEnabled: true
      },
      select: {
        depositEmailNotificationsEnabled: true,
        withdrawalEmailNotificationsEnabled: true,
        loanEmailNotificationsEnabled: true,
        productUpdateEmailNotificationsEnabled: true
      }
    });
    expect(result).toEqual({
      depositEmails: false,
      withdrawalEmails: true,
      loanEmails: false,
      productUpdateEmails: true
    });
  });

  it("throws when notification preferences are updated for a missing customer", async () => {
    const { service, prismaService } = createService({
      legacyUser,
      customerProjectionResult: customerProjection,
      walletProjectionResult: walletProjection
    });

    prismaService.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.updateNotificationPreferences("missing_user", {
        depositEmails: true,
        withdrawalEmails: true,
        loanEmails: true,
        productUpdateEmails: false
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
