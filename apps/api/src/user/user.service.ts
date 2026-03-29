import {
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import type {
  AccountLifecycleStatusValue,
  UserProfileProjection
} from "@stealth-trails-bank/types";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthService,
  type CustomerAccountProjection
} from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { SupabaseService } from "../supabase/supabase.service";
import { findCustomerWalletBySupabaseUserId } from "./customer-wallet-lookup";

type LegacyUserProfile = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

@Injectable()
export class UserService {
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
    private readonly prismaService: PrismaService
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  private async resolveEthereumAddress(
    supabaseUserId: string,
    legacyEthereumAddress: string | null
  ): Promise<string | null> {
    const walletLookup = await findCustomerWalletBySupabaseUserId(
      this.prismaService,
      supabaseUserId
    );

    return walletLookup.ethereumAddress ?? legacyEthereumAddress ?? null;
  }

  private formatOptionalDate(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private async mapLegacyUserProfile(
    legacyUser: LegacyUserProfile
  ): Promise<UserProfileProjection> {
    const ethereumAddress =
      (await this.resolveEthereumAddress(
        legacyUser.supabaseUserId,
        legacyUser.ethereumAddress
      )) ?? "";

    return {
      id: legacyUser.id,
      customerId: null,
      supabaseUserId: legacyUser.supabaseUserId,
      email: legacyUser.email,
      firstName: legacyUser.firstName,
      lastName: legacyUser.lastName,
      ethereumAddress,
      accountStatus: null,
      activatedAt: null,
      restrictedAt: null,
      frozenAt: null,
      closedAt: null
    };
  }

  private async mapCustomerProjectionWithLegacyOverlay(
    projection: CustomerAccountProjection,
    legacyUser: LegacyUserProfile | null
  ): Promise<UserProfileProjection> {
    const accountStatus =
      projection.customerAccount.status as AccountLifecycleStatusValue;

    const ethereumAddress =
      (await this.resolveEthereumAddress(
        projection.customer.supabaseUserId,
        legacyUser?.ethereumAddress ?? null
      )) ?? "";

    return {
      id: legacyUser?.id ?? null,
      customerId: projection.customer.id,
      supabaseUserId: projection.customer.supabaseUserId,
      email: projection.customer.email,
      firstName: projection.customer.firstName ?? "",
      lastName: projection.customer.lastName ?? "",
      ethereumAddress,
      accountStatus,
      activatedAt: this.formatOptionalDate(
        projection.customerAccount.activatedAt
      ),
      restrictedAt: this.formatOptionalDate(
        projection.customerAccount.restrictedAt
      ),
      frozenAt: this.formatOptionalDate(projection.customerAccount.frozenAt),
      closedAt: this.formatOptionalDate(projection.customerAccount.closedAt)
    };
  }

  private async getLegacyUserProfileBySupabaseUserId(
    supabaseUserId: string
  ): Promise<LegacyUserProfile | null> {
    const { data, error } = await this.supabase
      .from("User")
      .select("*")
      .eq("supabaseUserId", supabaseUserId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException("Failed to load user profile.");
    }

    return data as LegacyUserProfile | null;
  }

  async getUserById(supabaseUserId: string): Promise<UserProfileProjection> {
    const legacyUser =
      await this.getLegacyUserProfileBySupabaseUserId(supabaseUserId);

    try {
      const customerProjection =
        await this.authService.getCustomerAccountProjectionBySupabaseUserId(
          supabaseUserId
        );

      return await this.mapCustomerProjectionWithLegacyOverlay(
        customerProjection,
        legacyUser
      );
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      if (!legacyUser) {
        throw new NotFoundException("User profile not found.");
      }

      return await this.mapLegacyUserProfile(legacyUser);
    }
  }
}
