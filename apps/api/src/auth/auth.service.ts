import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  AccountLifecycleStatus,
  Prisma,
  WalletCustodyType,
  WalletKind,
  WalletStatus
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";
import {
  loadJwtRuntimeConfig,
  loadProductChainRuntimeConfig,
  loadSharedLoginBootstrapRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { generateEthereumAddress } from "./auth.util";

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

export type CustomerAccountProjection = {
  customer: {
    id: string;
    supabaseUserId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  customerAccount: {
    id: string;
    status: AccountLifecycleStatus;
    activatedAt: Date | null;
    restrictedAt: Date | null;
    frozenAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type CustomerWalletProjection = {
  wallet: {
    id: string;
    customerAccountId: string | null;
    chainId: number;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
    status: WalletStatus;
    createdAt: Date;
    updatedAt: Date;
  };
};

type PublicSignedUpUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ethereumAddress: string;
};

type PublicLoggedInUser = {
  id: number;
  supabaseUserId: string;
  email: string;
  ethereumAddress: string;
  firstName: string;
  lastName: string;
};

type SignUpResponseData = {
  user: PublicSignedUpUser;
};

type LoginResponseData = {
  token: string;
  user: PublicLoggedInUser;
};

type SharedLoginBootstrapResult = {
  customerId: string;
  customerAccountId: string;
  supabaseUserId: string;
  email: string;
  ethereumAddress: string;
  createdLegacyUser: boolean;
  createdCustomer: boolean;
  createdCustomerAccount: boolean;
};

@Injectable()
export class AuthService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private signToken(sub: string, email: string): string {
    const { jwtSecret, jwtExpirySeconds } = loadJwtRuntimeConfig();
    return jwt.sign({ sub, email }, jwtSecret, { expiresIn: jwtExpirySeconds });
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException("Email is required.");
    }

    return normalizedEmail;
  }

  private async checkEmailAvailability(email: string): Promise<void> {
    const existing = await this.prismaService.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Email already in use.");
    }
  }

  private async saveUserToDatabase(
    firstName: string,
    lastName: string,
    email: string,
    userId: string,
    ethereumAccountAddress: string
  ): Promise<void> {
    try {
      await this.prismaService.user.create({
        data: {
          firstName,
          lastName,
          email,
          supabaseUserId: userId,
          ethereumAddress: ethereumAccountAddress
        }
      });
    } catch {
      throw new InternalServerErrorException("Failed to save user profile.");
    }
  }

  private async syncCustomerWalletProjection(
    transaction: Prisma.TransactionClient,
    customerAccountId: string,
    ethereumAddress: string
  ): Promise<void> {
    const walletLookup = {
      chainId_address: {
        chainId: this.productChainId,
        address: ethereumAddress
      }
    } as const;

    const existingWallet = await transaction.wallet.findUnique({
      where: walletLookup
    });

    if (
      existingWallet &&
      existingWallet.customerAccountId &&
      existingWallet.customerAccountId !== customerAccountId
    ) {
      throw new Error(
        "Wallet address is already linked to another customer account."
      );
    }

    if (existingWallet) {
      await transaction.wallet.update({
        where: walletLookup,
        data: {
          customerAccountId,
          kind: WalletKind.embedded,
          custodyType: WalletCustodyType.platform_managed,
          status: WalletStatus.active
        }
      });

      return;
    }

    await transaction.wallet.create({
      data: {
        customerAccountId,
        chainId: this.productChainId,
        address: ethereumAddress,
        kind: WalletKind.embedded,
        custodyType: WalletCustodyType.platform_managed,
        status: WalletStatus.active
      }
    });
  }

  private async syncCustomerAccountProjection(
    firstName: string,
    lastName: string,
    email: string,
    supabaseUserId: string,
    ethereumAddress: string,
    passwordHash: string
  ): Promise<void> {
    try {
      await this.prismaService.$transaction(async (transaction) => {
        const customer = await transaction.customer.upsert({
          where: { email },
          update: {
            supabaseUserId,
            email,
            firstName,
            lastName
          },
          create: {
            supabaseUserId,
            email,
            firstName,
            lastName,
            passwordHash
          }
        });

        const customerAccount = await transaction.customerAccount.upsert({
          where: { customerId: customer.id },
          update: {},
          create: {
            customerId: customer.id,
            status: AccountLifecycleStatus.registered
          }
        });

        await this.syncCustomerWalletProjection(
          transaction,
          customerAccount.id,
          ethereumAddress
        );
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException(
        "Failed to initialize customer account."
      );
    }
  }

  async ensureSharedLoginAccount(): Promise<SharedLoginBootstrapResult | null> {
    const sharedLoginConfig = loadSharedLoginBootstrapRuntimeConfig();

    if (!sharedLoginConfig.enabled) {
      return null;
    }

    const email = this.normalizeEmail(sharedLoginConfig.email);
    const passwordHash = await bcrypt.hash(sharedLoginConfig.password, 12);

    return this.prismaService.$transaction(async (transaction) => {
      const existingCustomer = await transaction.customer.findUnique({
        where: { email },
        include: {
          accounts: {
            include: {
              wallets: {
                where: { chainId: this.productChainId },
                orderBy: { createdAt: "asc" },
                take: 1
              }
            },
            orderBy: { createdAt: "asc" },
            take: 1
          }
        }
      });
      const legacyUserByEmail = await transaction.user.findUnique({
        where: { email }
      });

      if (
        existingCustomer &&
        existingCustomer.supabaseUserId !== sharedLoginConfig.supabaseUserId
      ) {
        const conflictingCustomer = await transaction.customer.findUnique({
          where: { supabaseUserId: sharedLoginConfig.supabaseUserId },
          select: {
            id: true,
            email: true
          }
        });

        if (conflictingCustomer && conflictingCustomer.email !== email) {
          throw new InternalServerErrorException(
            "Configured shared login supabase user id is already assigned to another customer."
          );
        }
      }

      const supabaseUserId =
        existingCustomer?.supabaseUserId ??
        legacyUserByEmail?.supabaseUserId ??
        sharedLoginConfig.supabaseUserId;
      const existingCustomerAccount = existingCustomer?.accounts[0] ?? null;
      const existingWallet = existingCustomerAccount?.wallets[0] ?? null;
      const generatedEthereumAddress = generateEthereumAddress();
      const ethereumAddress =
        legacyUserByEmail?.ethereumAddress?.trim() ||
        existingWallet?.address?.trim() ||
        generatedEthereumAddress.address;

      const customer = await transaction.customer.upsert({
        where: { email },
        update: {
          supabaseUserId,
          email,
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          passwordHash
        },
        create: {
          supabaseUserId,
          email,
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          passwordHash
        }
      });

      const customerAccount = await transaction.customerAccount.upsert({
        where: { customerId: customer.id },
        update: {},
        create: {
          customerId: customer.id,
          status: AccountLifecycleStatus.registered
        }
      });

      await this.syncCustomerWalletProjection(
        transaction,
        customerAccount.id,
        ethereumAddress
      );

      const legacyUser = await transaction.user.upsert({
        where: { email },
        update: {
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          email,
          supabaseUserId,
          ethereumAddress
        },
        create: {
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          email,
          supabaseUserId,
          ethereumAddress
        }
      });

      return {
        customerId: customer.id,
        customerAccountId: customerAccount.id,
        supabaseUserId,
        email,
        ethereumAddress,
        createdLegacyUser: legacyUserByEmail === null,
        createdCustomer: existingCustomer === null,
        createdCustomerAccount: existingCustomerAccount === null
      };
    });
  }

  async getCustomerWalletProjectionBySupabaseUserId(
    supabaseUserId: string
  ): Promise<CustomerWalletProjection> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: { supabaseUserId }
      },
      include: {
        wallets: {
          where: { chainId: this.productChainId },
          orderBy: { createdAt: "asc" },
          take: 1
        }
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account not found.");
    }

    const wallet = customerAccount.wallets[0];

    if (!wallet) {
      throw new NotFoundException("Customer wallet projection not found.");
    }

    return {
      wallet: {
        id: wallet.id,
        customerAccountId: wallet.customerAccountId,
        chainId: wallet.chainId,
        address: wallet.address,
        kind: wallet.kind,
        custodyType: wallet.custodyType,
        status: wallet.status,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      }
    };
  }

  async getUserFromDatabaseById(
    supabaseUserId: string
  ): Promise<LegacyUserRecord | null> {
    return this.prismaService.user.findFirst({
      where: { supabaseUserId }
    });
  }

  async getCustomerAccountProjectionBySupabaseUserId(
    supabaseUserId: string
  ): Promise<CustomerAccountProjection> {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      include: { accounts: true }
    });

    if (!customer) {
      throw new NotFoundException("Customer projection not found.");
    }

    const customerAccount = customer.accounts[0];

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return {
      customer: {
        id: customer.id,
        supabaseUserId: customer.supabaseUserId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      },
      customerAccount: {
        id: customerAccount.id,
        status: customerAccount.status,
        activatedAt: customerAccount.activatedAt,
        restrictedAt: customerAccount.restrictedAt,
        frozenAt: customerAccount.frozenAt,
        closedAt: customerAccount.closedAt,
        createdAt: customerAccount.createdAt,
        updatedAt: customerAccount.updatedAt
      }
    };
  }

  async validateToken(token: string): Promise<{ id: string; email: string }> {
    try {
      const { jwtSecret } = loadJwtRuntimeConfig();
      const payload = jwt.verify(token, jwtSecret);

      if (typeof payload === "string") {
        throw new UnauthorizedException("Invalid or expired token.");
      }

      const sub = payload["sub"];
      const email = payload["email"];

      if (typeof sub !== "string" || typeof email !== "string") {
        throw new UnauthorizedException("Invalid or expired token.");
      }

      return { id: sub, email };
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }

  async signUp(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ): Promise<CustomJsonResponse<SignUpResponseData>> {
    const normalizedEmail = this.normalizeEmail(email);

    await this.checkEmailAvailability(normalizedEmail);

    const authUserId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const generatedEthereumAddress = generateEthereumAddress();

    await this.saveUserToDatabase(
      firstName,
      lastName,
      normalizedEmail,
      authUserId,
      generatedEthereumAddress.address
    );

    await this.syncCustomerAccountProjection(
      firstName,
      lastName,
      normalizedEmail,
      authUserId,
      generatedEthereumAddress.address,
      passwordHash
    );

    return {
      status: "success",
      message: "User signed up successfully.",
      data: {
        user: {
          id: authUserId,
          email: normalizedEmail,
          firstName,
          lastName,
          ethereumAddress: generatedEthereumAddress.address
        }
      }
    };
  }

  async login(
    email: string,
    password: string
  ): Promise<CustomJsonResponse<LoginResponseData>> {
    const normalizedEmail = this.normalizeEmail(email);
    const customer = await this.prismaService.customer.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        passwordHash: true
      }
    });

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordValid = await bcrypt.compare(password, customer.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const user = await this.getUserFromDatabaseById(customer.supabaseUserId);

    if (!user) {
      throw new InternalServerErrorException("User profile not found.");
    }

    const token = this.signToken(customer.supabaseUserId, customer.email);

    return {
      status: "success",
      message: "User logged in successfully.",
      data: {
        token,
        user: {
          id: user.id,
          supabaseUserId: customer.supabaseUserId,
          email: user.email,
          ethereumAddress: user.ethereumAddress ?? "",
          firstName: user.firstName,
          lastName: user.lastName
        }
      }
    };
  }
}
