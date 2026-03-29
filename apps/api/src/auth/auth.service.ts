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
import { SupabaseClient } from "@supabase/supabase-js";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import { SupabaseService } from "../supabase/supabase.service";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { generateEthereumAddress } from "./auth.util";

type RegisteredAuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

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

@Injectable()
export class AuthService {
  private readonly supabase: SupabaseClient;
  private readonly productChainId: number;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService
  ) {
    this.supabase = this.supabaseService.getClient();
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private async checkEmailAvailability(email: string): Promise<void> {
    const { data, error } = await this.supabase
      .from("User")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        "Failed to verify email availability."
      );
    }

    if (data) {
      throw new BadRequestException("Email already in use.");
    }
  }

  private async registerUserInSupabaseAuth(
    email: string,
    password: string
  ): Promise<RegisteredAuthUser> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password
    });

    if (error || !data.user?.id || !data.user.email || !data.user.created_at) {
      throw new InternalServerErrorException(
        error?.message ?? "Failed to register auth user."
      );
    }

    return {
      id: data.user.id,
      email: data.user.email,
      createdAt: data.user.created_at
    };
  }

  private async saveUserToDatabase(
    firstName: string,
    lastName: string,
    email: string,
    userId: string,
    ethereumAccountAddress: string
  ): Promise<void> {
    const { error } = await this.supabase.from("User").insert([
      {
        firstName,
        lastName,
        email,
        supabaseUserId: userId,
        ethereumAddress: ethereumAccountAddress
      }
    ]);

    if (error) {
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
    ethereumAddress: string
  ): Promise<void> {
    try {
      await this.prismaService.$transaction(async (transaction) => {
        const customer = await transaction.customer.upsert({
          where: {
            email
          },
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
            lastName
          }
        });

        const customerAccount = await transaction.customerAccount.upsert({
          where: {
            customerId: customer.id
          },
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

  async getUserFromDatabaseById(
    supabaseUserId: string
  ): Promise<LegacyUserRecord | null> {
    const { data, error } = await this.supabase
      .from("User")
      .select("*")
      .eq("supabaseUserId", supabaseUserId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException("Failed to load user profile.");
    }

    return data as LegacyUserRecord | null;
  }

  async getCustomerAccountProjectionBySupabaseUserId(
    supabaseUserId: string
  ): Promise<CustomerAccountProjection> {
    const customer = await this.prismaService.customer.findUnique({
      where: {
        supabaseUserId
      },
      include: {
        accounts: true
      }
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

  async validateToken(token: string): Promise<unknown> {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid or expired token.");
    }

    return data.user;
  }

  async signUp(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ): Promise<CustomJsonResponse> {
    await this.checkEmailAvailability(email);

    const registeredAuthUser = await this.registerUserInSupabaseAuth(
      email,
      password
    );
    const generatedEthereumAddress = generateEthereumAddress();

    await this.saveUserToDatabase(
      firstName,
      lastName,
      email,
      registeredAuthUser.id,
      generatedEthereumAddress.address
    );

    await this.syncCustomerAccountProjection(
      firstName,
      lastName,
      email,
      registeredAuthUser.id,
      generatedEthereumAddress.address
    );

    return {
      status: "success",
      message: "User signed up successfully.",
      data: {
        user: {
          id: registeredAuthUser.id,
          email: registeredAuthUser.email,
          created_at: registeredAuthUser.createdAt,
          firstName,
          lastName,
          address: generatedEthereumAddress.address,
          privateKey: generatedEthereumAddress.privateKey
        }
      }
    };
  }

  async login(
    email: string,
    password: string
  ): Promise<CustomJsonResponse> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const user = await this.getUserFromDatabaseById(data.user.id);

    if (!user) {
      throw new InternalServerErrorException("User profile not found.");
    }

    return {
      status: "success",
      message: "User logged in successfully.",
      data: {
        token: data.session?.access_token,
        user: {
          id: user.id,
          supabaseUserId: data.user.id,
          email: user.email,
          ethereumAddress: user.ethereumAddress ?? "",
          firstName: user.firstName,
          lastName: user.lastName
        }
      }
    };
  }
}
