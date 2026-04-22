import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { loadCustomerMfaPolicyRuntimeConfig } from "@stealth-trails-bank/config/api";
import type {
  AccountLifecycleStatusValue,
  CustomerAgeProfile,
  CustomerNotificationPreferences,
  CustomerTrustedContactKind,
  CustomerTrustedContactProjection,
  UserProfileProjection,
} from "@stealth-trails-bank/types";
import {
  AuthService,
  type CustomerAccountProjection,
  type CustomerWalletProjection,
} from "../auth/auth.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

type LegacyUserProfile = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

type CustomerProfileFoundation = {
  id: string;
  dateOfBirth: Date | null;
  ageVerificationStatus:
    | "unverified"
    | "self_attested"
    | "verified"
    | "rejected";
  ageVerifiedAt: Date | null;
  ageVerifiedByOperatorId: string | null;
  ageVerificationNote: string | null;
  trustedContacts: Array<{
    id: string;
    kind: "trusted_contact" | "beneficiary";
    status: "active" | "removed";
    firstName: string;
    lastName: string;
    relationshipLabel: string;
    email: string | null;
    phoneNumber: string | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    removedAt: Date | null;
  }>;
};

type CreateTrustedContactInput = {
  kind?: string;
  firstName: string;
  lastName: string;
  relationshipLabel: string;
  email?: string;
  phoneNumber?: string;
  note?: string;
};

type UpdateTrustedContactInput = {
  kind?: string;
  firstName?: string;
  lastName?: string;
  relationshipLabel?: string;
  email?: string;
  phoneNumber?: string;
  note?: string;
};

type LegacyNotificationPreferenceInput = {
  depositEmails: boolean;
  withdrawalEmails: boolean;
  loanEmails: boolean;
  productUpdateEmails: boolean;
};

@Injectable()
export class UserService {
  private readonly stepUpFreshnessMs: number;
  private readonly trustedContactKinds: readonly CustomerTrustedContactKind[] =
    ["trusted_contact", "beneficiary"] as const;

  constructor(
    private readonly authService: AuthService,
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.stepUpFreshnessMs =
      loadCustomerMfaPolicyRuntimeConfig().stepUpFreshnessSeconds * 1000;
  }

  private formatOptionalDate(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private formatDateOnly(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

    if (!match) {
      throw new BadRequestException(
        "Date of birth must use YYYY-MM-DD format.",
      );
    }

    const [, yearValue, monthValue, dayValue] = match;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException("Date of birth is invalid.");
    }

    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );

    if (parsed.getTime() > todayUtc) {
      throw new BadRequestException("Date of birth cannot be in the future.");
    }

    return parsed;
  }

  private calculateAgeYears(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const birthdayPassed =
      today.getUTCMonth() > dateOfBirth.getUTCMonth() ||
      (today.getUTCMonth() === dateOfBirth.getUTCMonth() &&
        today.getUTCDate() >= dateOfBirth.getUTCDate());

    if (!birthdayPassed) {
      age -= 1;
    }

    return age;
  }

  private mapAgeProfile(
    foundation: Pick<
      CustomerProfileFoundation,
      | "dateOfBirth"
      | "ageVerificationStatus"
      | "ageVerifiedAt"
      | "ageVerifiedByOperatorId"
      | "ageVerificationNote"
    >,
  ): CustomerAgeProfile {
    const ageYears = foundation.dateOfBirth
      ? this.calculateAgeYears(foundation.dateOfBirth)
      : null;

    return {
      dateOfBirth: this.formatDateOnly(foundation.dateOfBirth),
      ageYears,
      legalAdult: ageYears === null ? null : ageYears >= 18,
      verificationStatus: foundation.ageVerificationStatus,
      verifiedAt: this.formatOptionalDate(foundation.ageVerifiedAt),
      verifiedByOperatorId: foundation.ageVerifiedByOperatorId,
      verificationNote: foundation.ageVerificationNote,
    };
  }

  private mapTrustedContact(
    contact: CustomerProfileFoundation["trustedContacts"][number],
  ): CustomerTrustedContactProjection {
    return {
      id: contact.id,
      kind: contact.kind,
      status: contact.status,
      firstName: contact.firstName,
      lastName: contact.lastName,
      relationshipLabel: contact.relationshipLabel,
      email: contact.email,
      phoneNumber: contact.phoneNumber,
      note: contact.note,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      removedAt: this.formatOptionalDate(contact.removedAt),
    };
  }

  private mapTrustedContacts(
    foundation: CustomerProfileFoundation,
  ): CustomerTrustedContactProjection[] {
    return foundation.trustedContacts
      .map((contact) => this.mapTrustedContact(contact))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private normalizeRequiredText(value: string, fieldLabel: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldLabel} is required.`);
    }

    return normalized;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeTrustedContactKind(
    value?: string,
  ): CustomerTrustedContactKind {
    const normalized = value?.trim().toLowerCase() ?? "trusted_contact";

    if (
      !this.trustedContactKinds.includes(
        normalized as CustomerTrustedContactKind,
      )
    ) {
      throw new BadRequestException("Trusted contact kind is invalid.");
    }

    return normalized as CustomerTrustedContactKind;
  }

  private buildTrustedContactData(input: CreateTrustedContactInput): {
    kind: CustomerTrustedContactKind;
    firstName: string;
    lastName: string;
    relationshipLabel: string;
    email: string | null;
    phoneNumber: string | null;
    note: string | null;
  } {
    const email =
      this.normalizeOptionalText(input.email)?.toLowerCase() ?? null;
    const phoneNumber = this.normalizeOptionalText(input.phoneNumber);

    if (!email && !phoneNumber) {
      throw new BadRequestException(
        "Provide at least one trusted contact method.",
      );
    }

    return {
      kind: this.normalizeTrustedContactKind(input.kind),
      firstName: this.normalizeRequiredText(input.firstName, "First name"),
      lastName: this.normalizeRequiredText(input.lastName, "Last name"),
      relationshipLabel: this.normalizeRequiredText(
        input.relationshipLabel,
        "Relationship label",
      ),
      email,
      phoneNumber,
      note: this.normalizeOptionalText(input.note),
    };
  }

  private async getCustomerFoundationById(
    customerId: string,
  ): Promise<CustomerProfileFoundation> {
    const foundation = await this.prismaService.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        dateOfBirth: true,
        ageVerificationStatus: true,
        ageVerifiedAt: true,
        ageVerifiedByOperatorId: true,
        ageVerificationNote: true,
        trustedContacts: {
          where: {
            status: "active",
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            kind: true,
            status: true,
            firstName: true,
            lastName: true,
            relationshipLabel: true,
            email: true,
            phoneNumber: true,
            note: true,
            createdAt: true,
            updatedAt: true,
            removedAt: true,
          },
        },
      },
    });

    if (!foundation) {
      throw new NotFoundException("Customer profile not found.");
    }

    return foundation;
  }

  private async findCustomerIdentityOrThrow(supabaseUserId: string): Promise<{
    id: string;
    dateOfBirth: Date | null;
    ageVerificationStatus:
      | "unverified"
      | "self_attested"
      | "verified"
      | "rejected";
    ageVerifiedAt: Date | null;
    ageVerifiedByOperatorId: string | null;
    ageVerificationNote: string | null;
  }> {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        dateOfBirth: true,
        ageVerificationStatus: true,
        ageVerifiedAt: true,
        ageVerifiedByOperatorId: true,
        ageVerificationNote: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer profile not found.");
    }

    return customer;
  }

  private mapLegacyUserProfile(
    legacyUser: LegacyUserProfile,
  ): UserProfileProjection {
    return {
      id: legacyUser.id,
      customerId: null,
      supabaseUserId: legacyUser.supabaseUserId,
      email: legacyUser.email,
      firstName: legacyUser.firstName,
      lastName: legacyUser.lastName,
      ethereumAddress: legacyUser.ethereumAddress ?? "",
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
    };
  }

  private withLegacyNotificationPreferenceCompatibility(
    preferences: {
      audience: CustomerNotificationPreferences["audience"];
      entries: CustomerNotificationPreferences["entries"];
      updatedAt: CustomerNotificationPreferences["updatedAt"];
    },
  ): CustomerNotificationPreferences {
    const readEmailPreference = (
      category: CustomerNotificationPreferences["entries"][number]["category"],
    ) =>
      preferences.entries
        .find((entry) => entry.category === category)
        ?.channels.find((channel) => channel.channel === "email")?.enabled ?? false;

    return {
      ...preferences,
      depositEmails: readEmailPreference("money_movement"),
      withdrawalEmails: readEmailPreference("money_movement"),
      loanEmails: readEmailPreference("loans"),
      productUpdateEmails: readEmailPreference("product"),
    };
  }

  private resolveProfileEthereumAddress(
    walletProjection: CustomerWalletProjection | null,
    legacyUser: LegacyUserProfile | null,
  ): string {
    return (
      walletProjection?.wallet.address ?? legacyUser?.ethereumAddress ?? ""
    );
  }

  private mapCustomerProjectionWithWalletOverlay(
    projection: CustomerAccountProjection,
    walletProjection: CustomerWalletProjection | null,
    legacyUser: LegacyUserProfile | null,
    currentSessionTrusted: boolean,
    currentSessionRequiresVerification: boolean,
    foundation: CustomerProfileFoundation,
    notificationPreferences: CustomerNotificationPreferences,
  ): UserProfileProjection {
    const accountStatus = projection.customerAccount
      .status as AccountLifecycleStatusValue;

    return {
      id: legacyUser?.id ?? null,
      customerId: projection.customer.id,
      supabaseUserId: projection.customer.supabaseUserId,
      email: projection.customer.email,
      firstName: projection.customer.firstName ?? "",
      lastName: projection.customer.lastName ?? "",
      ethereumAddress: this.resolveProfileEthereumAddress(
        walletProjection,
        legacyUser,
      ),
      accountStatus,
      activatedAt: this.formatOptionalDate(
        projection.customerAccount.activatedAt,
      ),
      restrictedAt: this.formatOptionalDate(
        projection.customerAccount.restrictedAt,
      ),
      frozenAt: this.formatOptionalDate(projection.customerAccount.frozenAt),
      closedAt: this.formatOptionalDate(projection.customerAccount.closedAt),
      passwordRotationAvailable: Boolean(projection.customer.passwordHash),
      notificationPreferences,
      ageProfile: this.mapAgeProfile(foundation),
      trustedContacts: this.mapTrustedContacts(foundation),
      mfa: {
        required: projection.customer.mfaRequired,
        totpEnrolled: projection.customer.mfaTotpEnrolled,
        emailOtpEnrolled: projection.customer.mfaEmailOtpEnrolled,
        requiresSetup:
          projection.customer.mfaRequired &&
          (!projection.customer.mfaTotpEnrolled ||
            !projection.customer.mfaEmailOtpEnrolled),
        moneyMovementBlocked:
          projection.customer.mfaRequired &&
          (!projection.customer.mfaTotpEnrolled ||
            !projection.customer.mfaEmailOtpEnrolled),
        stepUpFreshUntil: projection.customer.mfaLastVerifiedAt
          ? new Date(
              projection.customer.mfaLastVerifiedAt.getTime() +
                this.stepUpFreshnessMs,
            ).toISOString()
          : null,
        lockedUntil: projection.customer.mfaLockedUntil?.toISOString() ?? null,
      },
      sessionSecurity: {
        currentSessionTrusted,
        currentSessionRequiresVerification,
      },
    };
  }

  private async getLegacyUserProfileBySupabaseUserId(
    supabaseUserId: string,
  ): Promise<LegacyUserProfile | null> {
    return this.prismaService.user.findFirst({
      where: { supabaseUserId },
    });
  }

  private async getCustomerWalletProjectionOrNull(
    supabaseUserId: string,
  ): Promise<CustomerWalletProjection | null> {
    try {
      return await this.authService.getCustomerWalletProjectionBySupabaseUserId(
        supabaseUserId,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }

      throw error;
    }
  }

  async getUserById(
    supabaseUserId: string,
    currentSessionId?: string | null,
  ): Promise<UserProfileProjection> {
    const legacyUser =
      await this.getLegacyUserProfileBySupabaseUserId(supabaseUserId);

    try {
      const customerProjection =
        await this.authService.getCustomerAccountProjectionBySupabaseUserId(
          supabaseUserId,
        );
      const walletProjection =
        await this.getCustomerWalletProjectionOrNull(supabaseUserId);
      const sessionSecurity =
        await this.authService.getCurrentCustomerSessionSecurityStatus(
          supabaseUserId,
          currentSessionId,
        );
      const foundation = await this.getCustomerFoundationById(
        customerProjection.customer.id,
      );
      const notificationPreferences =
        this.withLegacyNotificationPreferenceCompatibility(
          await this.notificationsService.getCustomerPreferences(supabaseUserId),
        );

      return this.mapCustomerProjectionWithWalletOverlay(
        customerProjection,
        walletProjection,
        legacyUser,
        sessionSecurity.currentSessionTrusted,
        sessionSecurity.currentSessionRequiresVerification,
        foundation,
        notificationPreferences,
      );
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      if (!legacyUser) {
        throw new NotFoundException("User profile not found.");
      }

      return this.mapLegacyUserProfile(legacyUser);
    }
  }

  async updateNotificationPreferences(
    supabaseUserId: string,
    input: LegacyNotificationPreferenceInput,
  ): Promise<CustomerNotificationPreferences> {
    const currentPreferences =
      await this.notificationsService.getCustomerPreferences(supabaseUserId);
    const updatedPreferences =
      await this.notificationsService.updateCustomerPreferences(supabaseUserId, {
        ...currentPreferences,
        entries: currentPreferences.entries.map((entry) => {
          if (entry.category === "money_movement") {
            return {
              ...entry,
              channels: entry.channels.map((channel) =>
                channel.channel === "email"
                  ? {
                      ...channel,
                      enabled:
                        input.depositEmails || input.withdrawalEmails,
                    }
                  : channel,
              ),
            };
          }

          if (entry.category === "loans") {
            return {
              ...entry,
              channels: entry.channels.map((channel) =>
                channel.channel === "email"
                  ? {
                      ...channel,
                      enabled: input.loanEmails,
                    }
                  : channel,
              ),
            };
          }

          if (entry.category === "product") {
            return {
              ...entry,
              channels: entry.channels.map((channel) =>
                channel.channel === "email"
                  ? {
                      ...channel,
                      enabled: input.productUpdateEmails,
                    }
                  : channel,
              ),
            };
          }

          return entry;
        }),
      });

    return this.withLegacyNotificationPreferenceCompatibility(updatedPreferences);
  }

  async updateAgeProfile(
    supabaseUserId: string,
    input: { dateOfBirth: string | null },
  ): Promise<CustomerAgeProfile> {
    const customer = await this.findCustomerIdentityOrThrow(supabaseUserId);

    if (input.dateOfBirth === null) {
      const clearedCustomer = await this.prismaService.customer.update({
        where: { id: customer.id },
        data: {
          dateOfBirth: null,
          ageVerificationStatus: "unverified",
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

      return this.mapAgeProfile(clearedCustomer);
    }

    const nextDateOfBirth = this.parseDateOnly(input.dateOfBirth);
    const currentDateOfBirth = this.formatDateOnly(customer.dateOfBirth);
    const nextDateValue = this.formatDateOnly(nextDateOfBirth);
    const dateChanged = currentDateOfBirth !== nextDateValue;

    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: dateChanged
        ? {
            dateOfBirth: nextDateOfBirth,
            ageVerificationStatus: "self_attested",
            ageVerifiedAt: null,
            ageVerifiedByOperatorId: null,
            ageVerificationNote: null,
          }
        : {
            dateOfBirth: nextDateOfBirth,
          },
      select: {
        dateOfBirth: true,
        ageVerificationStatus: true,
        ageVerifiedAt: true,
        ageVerifiedByOperatorId: true,
        ageVerificationNote: true,
      },
    });

    return this.mapAgeProfile(updatedCustomer);
  }

  async createTrustedContact(
    supabaseUserId: string,
    input: CreateTrustedContactInput,
  ): Promise<CustomerTrustedContactProjection> {
    const customer = await this.findCustomerIdentityOrThrow(supabaseUserId);
    const data = this.buildTrustedContactData(input);

    const trustedContact =
      await this.prismaService.customerTrustedContact.create({
        data: {
          customerId: customer.id,
          ...data,
        },
      });

    return this.mapTrustedContact(trustedContact);
  }

  async updateTrustedContact(
    supabaseUserId: string,
    contactId: string,
    input: UpdateTrustedContactInput,
  ): Promise<CustomerTrustedContactProjection> {
    const customer = await this.findCustomerIdentityOrThrow(supabaseUserId);
    const existingContact =
      await this.prismaService.customerTrustedContact.findFirst({
        where: {
          id: contactId,
          customerId: customer.id,
          status: "active",
        },
      });

    if (!existingContact) {
      throw new NotFoundException("Trusted contact not found.");
    }

    const mergedData = this.buildTrustedContactData({
      kind: input.kind ?? existingContact.kind,
      firstName: input.firstName ?? existingContact.firstName,
      lastName: input.lastName ?? existingContact.lastName,
      relationshipLabel:
        input.relationshipLabel ?? existingContact.relationshipLabel,
      email: input.email ?? existingContact.email ?? undefined,
      phoneNumber:
        input.phoneNumber ?? existingContact.phoneNumber ?? undefined,
      note: input.note ?? existingContact.note ?? undefined,
    });

    const trustedContact =
      await this.prismaService.customerTrustedContact.update({
        where: { id: existingContact.id },
        data: mergedData,
      });

    return this.mapTrustedContact(trustedContact);
  }

  async removeTrustedContact(
    supabaseUserId: string,
    contactId: string,
  ): Promise<string> {
    const customer = await this.findCustomerIdentityOrThrow(supabaseUserId);
    const trustedContact =
      await this.prismaService.customerTrustedContact.findFirst({
        where: {
          id: contactId,
          customerId: customer.id,
          status: "active",
        },
        select: {
          id: true,
        },
      });

    if (!trustedContact) {
      throw new NotFoundException("Trusted contact not found.");
    }

    await this.prismaService.customerTrustedContact.update({
      where: { id: trustedContact.id },
      data: {
        status: "removed",
        removedAt: new Date(),
      },
    });

    return trustedContact.id;
  }
}
