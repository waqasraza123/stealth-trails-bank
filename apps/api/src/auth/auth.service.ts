import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AccountLifecycleStatus,
  CustomerAuthSessionPlatform,
  CustomerAuthSessionRevocationReason,
  CustomerMfaRecoveryRequestStatus,
  CustomerMfaRecoveryRequestType,
  Prisma,
  ReviewCaseStatus,
  ReviewCaseType,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";
import {
  loadCustomerMfaPolicyRuntimeConfig,
  loadJwtRuntimeConfig,
  loadProductChainRuntimeConfig,
  loadSharedLoginBootstrapRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { NotificationsService } from "../notifications/notifications.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { writeStructuredApiLog } from "../logging/structured-api-logger";
import {
  buildOtpAuthUri,
  createOtpHash,
  generateBase32Secret,
  generateEmailOtpCode,
  otpHashMatches,
  verifyTotpCode,
} from "./customer-mfa.util";
import { generateEthereumAddress } from "./auth.util";
import { CustomerMfaEmailDeliveryService } from "./customer-mfa-email-delivery.service";
import { CustomerSecurityEmailDeliveryService } from "./customer-security-email-delivery.service";
import { assertOperatorRoleAuthorized } from "./internal-operator-role-policy";

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
    passwordHash: string | null;
    authTokenVersion: number;
    mfaRequired: boolean;
    mfaTotpEnrolled: boolean;
    mfaEmailOtpEnrolled: boolean;
    mfaLastVerifiedAt: Date | null;
    mfaLockedUntil: Date | null;
    depositEmailNotificationsEnabled: boolean;
    withdrawalEmailNotificationsEnabled: boolean;
    loanEmailNotificationsEnabled: boolean;
    productUpdateEmailNotificationsEnabled: boolean;
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

export type CustomerMfaStatus = {
  required: boolean;
  totpEnrolled: boolean;
  emailOtpEnrolled: boolean;
  requiresSetup: boolean;
  moneyMovementBlocked: boolean;
  stepUpFreshUntil: string | null;
  lockedUntil: string | null;
};

export type CustomerSessionSecurityStatus = {
  currentSessionTrusted: boolean;
  currentSessionRequiresVerification: boolean;
};

type CustomerMfaChallengeMethod = "totp" | "email_otp";
type CustomerMfaChallengePurpose =
  | "email_enrollment"
  | "email_recovery"
  | "withdrawal_step_up"
  | "password_step_up";

type CustomerSessionTrustChallengePurpose = "session_trust_verification";

type CustomerSessionContext = {
  currentSessionId?: string | null;
  clientPlatform?: "web" | "mobile" | "unknown" | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type CustomerMfaChallengeRecord = {
  id: string;
  purpose: CustomerMfaChallengePurpose;
  method: CustomerMfaChallengeMethod;
  codeHash: string | null;
  expiresAt: string;
  sentAt: string | null;
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
  mfa: CustomerMfaStatus;
  sessionSecurity: CustomerSessionSecurityStatus;
};

type SignUpResponseData = {
  user: PublicSignedUpUser;
};

type LoginResponseData = {
  token: string;
  user: PublicLoggedInUser;
};

type CustomerSessionRefreshData = {
  token: string;
  revokedOtherSessions: boolean;
};

type CustomerSessionProjection = {
  id: string;
  current: boolean;
  clientPlatform: "web" | "mobile" | "unknown";
  trusted: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
};

type CustomerSessionRiskChallengeState = "not_started" | "pending" | "expired";

type CustomerSessionRiskProjection = {
  id: string;
  clientPlatform: "web" | "mobile" | "unknown";
  trusted: boolean;
  challengeState: CustomerSessionRiskChallengeState;
  riskSeverity: "warning" | "critical";
  riskScore: number;
  riskReasons: string[];
  recommendedAction: "monitor" | "revoke_session" | "open_review_case";
  trustChallengeSentAt: string | null;
  trustChallengeExpiresAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  linkedReviewCase: {
    reviewCaseId: string;
    type: ReviewCaseType;
    status: ReviewCaseStatus;
    assignedOperatorId: string | null;
    updatedAt: string;
  } | null;
  customer: {
    customerId: string;
    customerAccountId: string | null;
    accountStatus: AccountLifecycleStatus | null;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

type ListCustomerSessionRisksResult = {
  sessions: CustomerSessionRiskProjection[];
  limit: number;
  totalCount: number;
  summary: {
    byChallengeState: Array<{
      challengeState: CustomerSessionRiskChallengeState;
      count: number;
    }>;
    byPlatform: Array<{
      clientPlatform: "web" | "mobile" | "unknown";
      count: number;
    }>;
    bySeverity: Array<{
      riskSeverity: "warning" | "critical";
      count: number;
    }>;
  };
};

type CustomerSessionRiskMutationResult = {
  session: CustomerSessionRiskProjection;
  stateReused: boolean;
};

type CustomerSessionRiskEscalationMutationResult = {
  session: CustomerSessionRiskProjection;
  reviewCase: {
    id: string;
    type: ReviewCaseType;
    status: ReviewCaseStatus;
    reasonCode: string | null;
    assignedOperatorId: string | null;
    updatedAt: string;
  };
  reviewCaseReused: boolean;
};

type CustomerSecurityActivityProjection = {
  id: string;
  kind:
    | "login"
    | "session_revoked"
    | "sessions_revoked"
    | "password_rotated"
    | "mfa_authenticator_enrolled"
    | "mfa_email_backup_enrolled"
    | "mfa_recovery_completed"
    | "mfa_step_up_verified"
    | "session_trust_verified";
  createdAt: string;
  clientPlatform: "web" | "mobile" | "unknown" | null;
  ipAddress: string | null;
  userAgent: string | null;
  purpose:
    | "withdrawal_step_up"
    | "password_step_up"
    | "email_enrollment"
    | "email_recovery"
    | null;
  method: "totp" | "email_otp" | null;
};

type ListCustomerSecurityActivityResponseData = {
  events: CustomerSecurityActivityProjection[];
  limit: number;
  totalCount: number;
};

type ListCustomerSessionsResponseData = {
  sessions: CustomerSessionProjection[];
  activeSessionCount: number;
};

type RevokeCustomerSessionResponseData = {
  revokedSessionId: string;
  activeSessionCount: number;
};

type UpdatePasswordResponseData = {
  passwordRotationAvailable: boolean;
  session: CustomerSessionRefreshData;
};

type MfaStatusResponseData = {
  mfa: CustomerMfaStatus;
};

type StartTotpEnrollmentResponseData = {
  mfa: CustomerMfaStatus;
  secret: string;
  otpAuthUri: string;
};

type StartEmailEnrollmentResponseData = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  expiresAt: string;
  deliveryChannel: "email";
  previewCode: string | null;
};

type VerifyMfaResponseData = {
  mfa: CustomerMfaStatus;
  session?: CustomerSessionRefreshData;
};

type SessionTrustStatusResponseData = {
  sessionSecurity: CustomerSessionSecurityStatus;
};

type StartSessionTrustChallengeResponseData = {
  sessionSecurity: CustomerSessionSecurityStatus;
  expiresAt: string;
  deliveryChannel: "email";
  previewCode: string | null;
};

type StartMfaChallengeResponseData = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  method: CustomerMfaChallengeMethod;
  purpose: CustomerMfaChallengePurpose;
  expiresAt: string;
  previewCode: string | null;
};

type RevokeCustomerSessionsResponseData = {
  session: CustomerSessionRefreshData;
};

type CustomerAuthSessionRecord = Prisma.CustomerAuthSessionGetPayload<{
  select: {
    id: true;
    tokenVersion: true;
    clientPlatform: true;
    trustedAt: true;
    trustChallengeCodeHash: true;
    trustChallengeExpiresAt: true;
    trustChallengeSentAt: true;
    userAgent: true;
    ipAddress: true;
    createdAt: true;
    lastSeenAt: true;
    revokedAt: true;
    customerId: true;
  };
}>;

type CustomerSessionRiskRecord = Prisma.CustomerAuthSessionGetPayload<{
  select: {
    id: true;
    clientPlatform: true;
    trustedAt: true;
    trustChallengeCodeHash: true;
    trustChallengeExpiresAt: true;
    trustChallengeSentAt: true;
    userAgent: true;
    ipAddress: true;
    createdAt: true;
    lastSeenAt: true;
    revokedAt: true;
    customerId: true;
    customer: {
      select: {
        id: true;
        supabaseUserId: true;
        email: true;
        firstName: true;
        lastName: true;
        accounts: {
          select: {
            id: true;
            status: true;
          };
          orderBy: {
            createdAt: "asc";
          };
          take: 1;
        };
      };
    };
  };
}>;

type CustomerSessionRiskAssessment = {
  riskSeverity: "warning" | "critical";
  riskScore: number;
  riskReasons: string[];
  recommendedAction: "monitor" | "revoke_session" | "open_review_case";
};

type CustomerSecurityAuditEventRecord = Prisma.AuditEventGetPayload<{
  select: {
    id: true;
    action: true;
    metadata: true;
    createdAt: true;
  };
}>;

type CustomerMfaRecoveryRequestRecord =
  Prisma.CustomerMfaRecoveryRequestGetPayload<{
    include: {
      customer: {
        select: {
          id: true;
          supabaseUserId: true;
          email: true;
          firstName: true;
          lastName: true;
        };
      };
      customerAccount: {
        select: {
          id: true;
          status: true;
        };
      };
    };
  }>;

type CustomerMfaRecoveryRequestProjection = {
  id: string;
  requestType: CustomerMfaRecoveryRequestType;
  status: CustomerMfaRecoveryRequestStatus;
  requestNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string;
  requestedAt: string;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  approvalNote: string | null;
  approvedAt: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  rejectionNote: string | null;
  rejectedAt: string | null;
  executedByOperatorId: string | null;
  executedByOperatorRole: string | null;
  executionNote: string | null;
  executedAt: string | null;
  customer: {
    customerId: string;
    customerAccountId: string | null;
    accountStatus: AccountLifecycleStatus | null;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

type CustomerMfaRecoveryRequestMutationResult = {
  request: CustomerMfaRecoveryRequestProjection;
  stateReused: boolean;
};

type ListCustomerMfaRecoveryRequestsResult = {
  requests: CustomerMfaRecoveryRequestProjection[];
  limit: number;
  totalCount: number;
  summary: {
    byStatus: Array<{
      status: CustomerMfaRecoveryRequestStatus;
      count: number;
    }>;
  };
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
  private readonly emailOtpExpiryMs: number;
  private readonly stepUpFreshnessMs: number;
  private readonly totpEnrollmentExpiryMs: number;
  private readonly maxFailedAttempts: number;
  private readonly lockoutDurationMs: number;
  private readonly challengeStartCooldownMs: number;
  private readonly recoveryRequestAllowedOperatorRoles: readonly string[];
  private readonly recoveryApproverAllowedOperatorRoles: readonly string[];
  private readonly sessionRiskReadAllowedOperatorRoles: readonly string[];
  private readonly sessionRiskRevokeAllowedOperatorRoles: readonly string[];
  private readonly sessionRiskEscalationAllowedOperatorRoles: readonly string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly customerMfaEmailDeliveryService: CustomerMfaEmailDeliveryService,
    private readonly customerSecurityEmailDeliveryService: CustomerSecurityEmailDeliveryService,
    private readonly reviewCasesService: ReviewCasesService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    const customerMfaPolicy = loadCustomerMfaPolicyRuntimeConfig();
    this.emailOtpExpiryMs = customerMfaPolicy.emailOtpExpirySeconds * 1000;
    this.stepUpFreshnessMs = customerMfaPolicy.stepUpFreshnessSeconds * 1000;
    this.totpEnrollmentExpiryMs =
      customerMfaPolicy.totpEnrollmentExpirySeconds * 1000;
    this.maxFailedAttempts = customerMfaPolicy.maxFailedAttempts;
    this.lockoutDurationMs = customerMfaPolicy.lockoutSeconds * 1000;
    this.challengeStartCooldownMs =
      customerMfaPolicy.challengeStartCooldownSeconds * 1000;
    this.recoveryRequestAllowedOperatorRoles =
      customerMfaPolicy.recoveryRequestAllowedOperatorRoles;
    this.recoveryApproverAllowedOperatorRoles =
      customerMfaPolicy.recoveryApproverAllowedOperatorRoles;
    this.sessionRiskReadAllowedOperatorRoles =
      customerMfaPolicy.sessionRiskReadAllowedOperatorRoles;
    this.sessionRiskRevokeAllowedOperatorRoles =
      customerMfaPolicy.sessionRiskRevokeAllowedOperatorRoles;
    this.sessionRiskEscalationAllowedOperatorRoles =
      customerMfaPolicy.sessionRiskEscalationAllowedOperatorRoles;
  }

  private buildCustomerMfaStatus(input: {
    mfaRequired: boolean;
    mfaTotpEnrolled: boolean;
    mfaEmailOtpEnrolled: boolean;
    mfaLastVerifiedAt: Date | null;
    mfaLockedUntil?: Date | null;
  }): CustomerMfaStatus {
    const required = input.mfaRequired;
    const requiresSetup =
      required && (!input.mfaTotpEnrolled || !input.mfaEmailOtpEnrolled);
    const moneyMovementBlocked = requiresSetup;
    const stepUpFreshUntil = input.mfaLastVerifiedAt
      ? new Date(
          input.mfaLastVerifiedAt.getTime() + this.stepUpFreshnessMs,
        ).toISOString()
      : null;

    return {
      required,
      totpEnrolled: input.mfaTotpEnrolled,
      emailOtpEnrolled: input.mfaEmailOtpEnrolled,
      requiresSetup,
      moneyMovementBlocked,
      stepUpFreshUntil,
      lockedUntil: input.mfaLockedUntil?.toISOString() ?? null,
    };
  }

  private parseChallenge(value: unknown): CustomerMfaChallengeRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (
      typeof record.id !== "string" ||
      typeof record.purpose !== "string" ||
      typeof record.method !== "string" ||
      typeof record.expiresAt !== "string"
    ) {
      return null;
    }

    return {
      id: record.id,
      purpose: record.purpose as CustomerMfaChallengePurpose,
      method: record.method as CustomerMfaChallengeMethod,
      codeHash: typeof record.codeHash === "string" ? record.codeHash : null,
      expiresAt: record.expiresAt,
      sentAt: typeof record.sentAt === "string" ? record.sentAt : null,
    };
  }

  private serializeChallenge(
    challenge: CustomerMfaChallengeRecord,
  ): PrismaJsonValue {
    return {
      id: challenge.id,
      purpose: challenge.purpose,
      method: challenge.method,
      codeHash: challenge.codeHash,
      expiresAt: challenge.expiresAt,
      sentAt: challenge.sentAt,
    } as PrismaJsonValue;
  }

  private assertChallengeActive(
    challenge: CustomerMfaChallengeRecord | null,
    purpose: CustomerMfaChallengePurpose,
    method: CustomerMfaChallengeMethod,
    challengeId?: string,
  ): CustomerMfaChallengeRecord {
    if (!challenge) {
      throw new BadRequestException("No active MFA challenge is available.");
    }

    if (
      challenge.purpose !== purpose ||
      challenge.method !== method ||
      (challengeId && challenge.id !== challengeId)
    ) {
      throw new BadRequestException("MFA challenge details do not match.");
    }

    if (Date.parse(challenge.expiresAt) <= Date.now()) {
      throw new BadRequestException(
        "MFA challenge expired. Start a new challenge.",
      );
    }

    return challenge;
  }

  private assertMoneyMovementEnabled(status: CustomerMfaStatus): void {
    if (status.lockedUntil && Date.parse(status.lockedUntil) > Date.now()) {
      throw new ForbiddenException(
        `Customer MFA is temporarily locked. Try again after ${status.lockedUntil}.`,
      );
    }

    if (status.moneyMovementBlocked) {
      throw new ForbiddenException(
        "Finish authenticator and email MFA setup before using send or withdraw.",
      );
    }
  }

  private assertStepUpFresh(status: CustomerMfaStatus): void {
    this.assertMoneyMovementEnabled(status);

    if (
      !status.stepUpFreshUntil ||
      Date.parse(status.stepUpFreshUntil) <= Date.now()
    ) {
      throw new ForbiddenException(
        "A fresh MFA verification is required before completing this action.",
      );
    }
  }

  private assertCurrentSessionTrusted(
    status: CustomerSessionSecurityStatus,
  ): void {
    if (status.currentSessionRequiresVerification) {
      throw new ForbiddenException(
        "Verify this unfamiliar session from the security screen before using money movement or password rotation.",
      );
    }
  }

  private async getCurrentCustomerSessionRecord(
    supabaseUserId: string,
    currentSessionId?: string | null,
  ): Promise<CustomerAuthSessionRecord | null> {
    if (!currentSessionId) {
      return null;
    }

    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer session profile not found.");
    }

    const session = await this.prismaService.customerAuthSession.findUnique({
      where: { id: currentSessionId },
      select: {
        id: true,
        tokenVersion: true,
        clientPlatform: true,
        trustedAt: true,
        trustChallengeCodeHash: true,
        trustChallengeExpiresAt: true,
        trustChallengeSentAt: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
        customerId: true,
      },
    });

    if (!session || session.customerId !== customer.id || session.revokedAt) {
      throw new UnauthorizedException("Session is no longer valid.");
    }

    return session;
  }

  private assertSessionTrustChallengeCooldown(input: {
    trustChallengeSentAt?: Date | null;
  }): void {
    if (
      input.trustChallengeSentAt &&
      input.trustChallengeSentAt.getTime() + this.challengeStartCooldownMs >
        Date.now()
    ) {
      throw new BadRequestException(
        "Wait before sending another session verification code.",
      );
    }
  }

  private async issueCustomerSessionTrustChallenge(input: {
    customerId: string;
    actorId: string;
    email: string;
    sessionId: string;
    context?: CustomerSessionContext;
    existingSentAt?: Date | null;
    ignoreCooldown?: boolean;
  }): Promise<{
    expiresAt: string;
    previewCode: string | null;
  }> {
    if (!input.ignoreCooldown) {
      this.assertSessionTrustChallengeCooldown({
        trustChallengeSentAt: input.existingSentAt,
      });
    }

    const code = generateEmailOtpCode();
    const expiresAt = new Date(Date.now() + this.emailOtpExpiryMs);

    await this.prismaService.customerAuthSession.update({
      where: { id: input.sessionId },
      data: {
        trustedAt: null,
        trustChallengeCodeHash: createOtpHash(code),
        trustChallengeExpiresAt: expiresAt,
        trustChallengeSentAt: new Date(),
      },
    });

    try {
      const deliveryResult =
        await this.customerMfaEmailDeliveryService.sendCode({
          customerId: input.customerId,
          actorId: input.actorId,
          email: input.email,
          challengeId: input.sessionId,
          purpose: "session_trust_verification",
          code,
          expiresAt: expiresAt.toISOString(),
        });

      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "customer_account.session_trust_challenge_started",
        targetType: "CustomerAuthSession",
        targetId: input.sessionId,
        metadata: {
          sessionId: input.sessionId,
          purpose: "session_trust_verification",
          method: "email_otp",
          clientPlatform: this.normalizeSessionPlatform(
            input.context?.clientPlatform,
          ),
          userAgent: this.normalizeOptionalText(input.context?.userAgent),
          ipAddress: this.normalizeOptionalText(input.context?.ipAddress),
          deliveryBackendType: deliveryResult.backendType,
          deliveryBackendReference: deliveryResult.backendReference,
        } as PrismaJsonValue,
      });

      return {
        expiresAt: expiresAt.toISOString(),
        previewCode: deliveryResult.previewCode,
      };
    } catch (error) {
      await this.prismaService.customerAuthSession.update({
        where: { id: input.sessionId },
        data: {
          trustChallengeCodeHash: null,
          trustChallengeExpiresAt: null,
          trustChallengeSentAt: null,
        },
      });

      throw error;
    }
  }

  private async appendAuditEvent(input: {
    customerId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: PrismaJsonValue;
  }): Promise<void> {
    const auditEvent = await this.prismaService.auditEvent.create({
      data: {
        customerId: input.customerId,
        actorType: "customer",
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? input.customerId,
        metadata: input.metadata,
      },
    });
    await this.publishAuditEventNotification(auditEvent);
  }

  private async appendOperatorAuditEvent(input: {
    customerId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: PrismaJsonValue;
  }): Promise<void> {
    const auditEvent = await this.prismaService.auditEvent.create({
      data: {
        customerId: input.customerId,
        actorType: "operator",
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? input.customerId,
        metadata: input.metadata,
      },
    });
    await this.publishAuditEventNotification(auditEvent);
  }

  private async publishAuditEventNotification(
    auditEvent: Prisma.AuditEventGetPayload<{}>,
  ): Promise<void> {
    try {
      await this.notificationsService.publishAuditEventRecord(auditEvent);
    } catch (error) {
      writeStructuredApiLog("warn", "audit_notification_projection_failed", {
        auditEventId: auditEvent.id,
        action: auditEvent.action,
        error,
      });
    }
  }

  private normalizeSessionPlatform(
    value?: string | null,
  ): CustomerAuthSessionPlatform {
    if (value === "web") {
      return CustomerAuthSessionPlatform.web;
    }

    if (value === "mobile") {
      return CustomerAuthSessionPlatform.mobile;
    }

    return CustomerAuthSessionPlatform.unknown;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private buildCustomerSessionSecurityStatus(
    session?: { trustedAt?: Date | null } | null,
  ): CustomerSessionSecurityStatus {
    if (!session) {
      return {
        currentSessionTrusted: true,
        currentSessionRequiresVerification: false,
      };
    }

    return {
      currentSessionTrusted: Boolean(session.trustedAt),
      currentSessionRequiresVerification: !session.trustedAt,
    };
  }

  private async hasRecognizedCustomerSessionSignature(
    customerId: string,
    context?: CustomerSessionContext,
  ): Promise<boolean> {
    const clientPlatform = this.normalizeSessionPlatform(
      context?.clientPlatform,
    );
    const userAgent = this.normalizeOptionalText(context?.userAgent);
    const ipAddress = this.normalizeOptionalText(context?.ipAddress);

    if (
      clientPlatform === CustomerAuthSessionPlatform.unknown &&
      !userAgent &&
      !ipAddress
    ) {
      return true;
    }

    const matchingSession =
      await this.prismaService.customerAuthSession.findFirst({
        where: {
          customerId,
          clientPlatform,
          ...(userAgent ? { userAgent } : { userAgent: null }),
        },
        select: {
          id: true,
        },
      });

    return Boolean(matchingSession);
  }

  private isSchemaCompatibilityError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === "P2021" || error.code === "P2022";
    }

    if (error instanceof Error) {
      return /does not exist|column .* does not exist|relation .* does not exist/i.test(
        error.message,
      );
    }

    return false;
  }

  private async createLoginSession(input: {
    customerId: string;
    tokenVersion: number;
    context?: CustomerSessionContext;
  }): Promise<{
    recognizedSessionSignature: boolean;
    sessionId: string | null;
  }> {
    try {
      const recognizedSessionSignature =
        await this.hasRecognizedCustomerSessionSignature(
          input.customerId,
          input.context,
        );
      const sessionId = await this.createCustomerAuthSession(
        this.prismaService,
        {
          customerId: input.customerId,
          tokenVersion: input.tokenVersion,
          context: input.context,
          trusted: recognizedSessionSignature,
        },
      );

      return {
        recognizedSessionSignature,
        sessionId,
      };
    } catch (error) {
      if (!this.isSchemaCompatibilityError(error)) {
        throw error;
      }

      writeStructuredApiLog("warn", "customer_auth_session_unavailable", {
        customerId: input.customerId,
        error,
      });

      return {
        recognizedSessionSignature: true,
        sessionId: null,
      };
    }
  }

  private mapCustomerSession(
    session: CustomerAuthSessionRecord,
    currentSessionId?: string | null,
  ): CustomerSessionProjection {
    return {
      id: session.id,
      current: currentSessionId === session.id,
      clientPlatform: session.clientPlatform,
      trusted: Boolean(session.trustedAt),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
    };
  }

  private resolveCustomerSessionRiskChallengeState(input: {
    trustedAt?: Date | null;
    trustChallengeCodeHash?: string | null;
    trustChallengeExpiresAt?: Date | null;
  }): CustomerSessionRiskChallengeState {
    if (input.trustedAt || !input.trustChallengeCodeHash) {
      return "not_started";
    }

    if (
      input.trustChallengeExpiresAt &&
      input.trustChallengeExpiresAt.getTime() > Date.now()
    ) {
      return "pending";
    }

    return "expired";
  }

  private mapCustomerSessionRisk(
    session: CustomerSessionRiskRecord,
    assessment: CustomerSessionRiskAssessment,
    linkedReviewCase?: {
      id: string;
      type: ReviewCaseType;
      status: ReviewCaseStatus;
      assignedOperatorId: string | null;
      updatedAt: Date;
    } | null,
  ): CustomerSessionRiskProjection {
    const customerAccount = session.customer.accounts[0] ?? null;

    return {
      id: session.id,
      clientPlatform: session.clientPlatform,
      trusted: Boolean(session.trustedAt),
      challengeState: this.resolveCustomerSessionRiskChallengeState(session),
      riskSeverity: assessment.riskSeverity,
      riskScore: assessment.riskScore,
      riskReasons: assessment.riskReasons,
      recommendedAction: assessment.recommendedAction,
      trustChallengeSentAt: session.trustChallengeSentAt?.toISOString() ?? null,
      trustChallengeExpiresAt:
        session.trustChallengeExpiresAt?.toISOString() ?? null,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      linkedReviewCase: linkedReviewCase
        ? {
            reviewCaseId: linkedReviewCase.id,
            type: linkedReviewCase.type,
            status: linkedReviewCase.status,
            assignedOperatorId: linkedReviewCase.assignedOperatorId,
            updatedAt: linkedReviewCase.updatedAt.toISOString(),
          }
        : null,
      customer: {
        customerId: session.customer.id,
        customerAccountId: customerAccount?.id ?? null,
        accountStatus: customerAccount?.status ?? null,
        supabaseUserId: session.customer.supabaseUserId,
        email: session.customer.email,
        firstName: session.customer.firstName ?? "",
        lastName: session.customer.lastName ?? "",
      },
    };
  }

  private assessCustomerSessionRisk(input: {
    session: Pick<
      CustomerSessionRiskRecord,
      | "clientPlatform"
      | "trustedAt"
      | "trustChallengeCodeHash"
      | "trustChallengeExpiresAt"
      | "userAgent"
      | "ipAddress"
      | "lastSeenAt"
    >;
    activeUntrustedSessionCountForCustomer: number;
    activeSessionCountForCustomer: number;
  }): CustomerSessionRiskAssessment {
    const reasons: string[] = [];
    let riskScore = 0;
    const challengeState = this.resolveCustomerSessionRiskChallengeState(
      input.session,
    );
    const now = Date.now();
    const lastSeenAgeMs = Math.max(0, now - input.session.lastSeenAt.getTime());

    if (input.session.clientPlatform === CustomerAuthSessionPlatform.unknown) {
      riskScore += 2;
      reasons.push("unknown_platform");
    }

    if (!input.session.userAgent) {
      riskScore += 1;
      reasons.push("missing_user_agent");
    }

    if (!input.session.ipAddress) {
      riskScore += 1;
      reasons.push("missing_ip_address");
    }

    if (challengeState === "expired") {
      riskScore += 2;
      reasons.push("expired_trust_challenge");
    } else if (challengeState === "not_started") {
      riskScore += 1;
      reasons.push("trust_challenge_not_started");
    }

    if (lastSeenAgeMs <= 15 * 60 * 1000) {
      riskScore += 2;
      reasons.push("recent_session_activity");
    }

    if (input.activeUntrustedSessionCountForCustomer >= 2) {
      riskScore += 2;
      reasons.push("multiple_untrusted_sessions");
    }

    if (input.activeSessionCountForCustomer >= 4) {
      riskScore += 1;
      reasons.push("high_active_session_count");
    }

    const riskSeverity = riskScore >= 5 ? "critical" : "warning";
    const recommendedAction =
      riskSeverity === "critical" || challengeState === "expired"
        ? "open_review_case"
        : challengeState === "pending"
          ? "revoke_session"
          : "monitor";

    return {
      riskSeverity,
      riskScore,
      riskReasons: reasons,
      recommendedAction,
    };
  }

  private mapCustomerSecurityActivity(
    event: CustomerSecurityAuditEventRecord,
  ): CustomerSecurityActivityProjection | null {
    const metadata =
      event.metadata &&
      typeof event.metadata === "object" &&
      !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : {};
    const clientPlatformValue = metadata["clientPlatform"];
    const purposeValue = metadata["purpose"];
    const methodValue = metadata["method"];

    const base = {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      clientPlatform:
        clientPlatformValue === "web" ||
        clientPlatformValue === "mobile" ||
        clientPlatformValue === "unknown"
          ? clientPlatformValue
          : null,
      ipAddress:
        typeof metadata["ipAddress"] === "string"
          ? metadata["ipAddress"]
          : null,
      userAgent:
        typeof metadata["userAgent"] === "string"
          ? metadata["userAgent"]
          : null,
      purpose:
        purposeValue === "withdrawal_step_up" ||
        purposeValue === "password_step_up" ||
        purposeValue === "email_enrollment" ||
        purposeValue === "email_recovery"
          ? purposeValue
          : null,
      method:
        methodValue === "totp" || methodValue === "email_otp"
          ? methodValue
          : null,
    } satisfies Omit<CustomerSecurityActivityProjection, "kind">;

    switch (event.action) {
      case "customer_account.session_created":
        return {
          ...base,
          kind: "login",
        };
      case "customer_account.session_revoked":
        return {
          ...base,
          kind: "session_revoked",
        };
      case "customer_account.sessions_revoked":
        return {
          ...base,
          kind: "sessions_revoked",
        };
      case "customer_account.password_rotated":
        return {
          ...base,
          kind: "password_rotated",
        };
      case "customer_account.mfa_totp_enrolled":
        return {
          ...base,
          kind: "mfa_authenticator_enrolled",
        };
      case "customer_account.mfa_email_enrolled":
        return {
          ...base,
          kind: "mfa_email_backup_enrolled",
        };
      case "customer_account.mfa_recovery_completed":
        return {
          ...base,
          kind: "mfa_recovery_completed",
        };
      case "customer_account.mfa_challenge_verified":
        return {
          ...base,
          kind: "mfa_step_up_verified",
        };
      case "customer_account.session_trusted":
        return {
          ...base,
          kind: "session_trust_verified",
        };
      default:
        return null;
    }
  }

  private async createCustomerAuthSession(
    transaction: Prisma.TransactionClient,
    input: {
      customerId: string;
      tokenVersion: number;
      context?: CustomerSessionContext;
      trusted?: boolean;
    },
  ): Promise<string> {
    const createdSession = await transaction.customerAuthSession.create({
      data: {
        customerId: input.customerId,
        tokenVersion: input.tokenVersion,
        trustedAt: input.trusted ? new Date() : undefined,
        clientPlatform: this.normalizeSessionPlatform(
          input.context?.clientPlatform,
        ),
        userAgent:
          this.normalizeOptionalText(input.context?.userAgent) ?? undefined,
        ipAddress:
          this.normalizeOptionalText(input.context?.ipAddress) ?? undefined,
      },
      select: {
        id: true,
      },
    });

    return createdSession.id;
  }

  private signToken(
    sub: string,
    email: string,
    authTokenVersion: number,
    sessionId?: string | null,
  ): string {
    const { jwtSecret, jwtExpirySeconds } = loadJwtRuntimeConfig();
    return jwt.sign(
      {
        sub,
        email,
        v: authTokenVersion,
        ...(sessionId ? { sid: sessionId } : {}),
      },
      jwtSecret,
      {
        expiresIn: jwtExpirySeconds,
      },
    );
  }

  private async buildSessionRefresh(
    input: {
      customerId: string;
      supabaseUserId: string;
      email: string;
      authTokenVersion: number;
      trusted?: boolean;
    },
    context?: CustomerSessionContext,
    revokedOtherSessions = true,
  ): Promise<CustomerSessionRefreshData> {
    const sessionId = await this.createCustomerAuthSession(this.prismaService, {
      customerId: input.customerId,
      tokenVersion: input.authTokenVersion,
      context,
      trusted: input.trusted,
    });

    return {
      token: this.signToken(
        input.supabaseUserId,
        input.email,
        input.authTokenVersion,
        sessionId,
      ),
      revokedOtherSessions,
    };
  }

  private async replaceActiveCustomerSessions(
    transaction: Prisma.TransactionClient,
    input: {
      customerId: string;
      supabaseUserId: string;
      email: string;
      authTokenVersion: number;
      revocationReason: CustomerAuthSessionRevocationReason;
      context?: CustomerSessionContext;
      trusted?: boolean;
    },
  ): Promise<CustomerSessionRefreshData> {
    await transaction.customerAuthSession.updateMany({
      where: {
        customerId: input.customerId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: input.revocationReason,
      },
    });

    const sessionId = await this.createCustomerAuthSession(transaction, {
      customerId: input.customerId,
      tokenVersion: input.authTokenVersion,
      context: input.context,
      trusted: input.trusted,
    });

    return {
      token: this.signToken(
        input.supabaseUserId,
        input.email,
        input.authTokenVersion,
        sessionId,
      ),
      revokedOtherSessions: true,
    };
  }

  private async rotateCustomerSession(
    transaction: Prisma.TransactionClient,
    input: {
      customerId: string;
      supabaseUserId: string;
      email: string;
      revocationReason: CustomerAuthSessionRevocationReason;
      context?: CustomerSessionContext;
    },
  ): Promise<CustomerSessionRefreshData> {
    const updatedCustomer = await transaction.customer.update({
      where: { id: input.customerId },
      data: {
        authTokenVersion: {
          increment: 1,
        },
      },
      select: {
        authTokenVersion: true,
      },
    });

    return this.replaceActiveCustomerSessions(transaction, {
      customerId: input.customerId,
      supabaseUserId: input.supabaseUserId,
      email: input.email,
      authTokenVersion: updatedCustomer.authTokenVersion,
      revocationReason: input.revocationReason,
      context: input.context,
      trusted: true,
    });
  }

  private mapCustomerMfaRecoveryRequest(
    request: CustomerMfaRecoveryRequestRecord,
  ): CustomerMfaRecoveryRequestProjection {
    return {
      id: request.id,
      requestType: request.requestType,
      status: request.status,
      requestNote: request.requestNote ?? null,
      requestedByOperatorId: request.requestedByOperatorId,
      requestedByOperatorRole: request.requestedByOperatorRole,
      requestedAt: request.requestedAt.toISOString(),
      approvedByOperatorId: request.approvedByOperatorId ?? null,
      approvedByOperatorRole: request.approvedByOperatorRole ?? null,
      approvalNote: request.approvalNote ?? null,
      approvedAt: request.approvedAt?.toISOString() ?? null,
      rejectedByOperatorId: request.rejectedByOperatorId ?? null,
      rejectedByOperatorRole: request.rejectedByOperatorRole ?? null,
      rejectionNote: request.rejectionNote ?? null,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      executedByOperatorId: request.executedByOperatorId ?? null,
      executedByOperatorRole: request.executedByOperatorRole ?? null,
      executionNote: request.executionNote ?? null,
      executedAt: request.executedAt?.toISOString() ?? null,
      customer: {
        customerId: request.customer.id,
        customerAccountId: request.customerAccount?.id ?? null,
        accountStatus: request.customerAccount?.status ?? null,
        supabaseUserId: request.customer.supabaseUserId,
        email: request.customer.email,
        firstName: request.customer.firstName ?? "",
        lastName: request.customer.lastName ?? "",
      },
    };
  }

  private assertCanRequestCustomerMfaRecovery(operatorRole?: string | null) {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.recoveryRequestAllowedOperatorRoles,
      "Operator role is not authorized to request customer MFA recovery.",
    );
  }

  private assertCanApproveCustomerMfaRecovery(operatorRole?: string | null) {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.recoveryApproverAllowedOperatorRoles,
      "Operator role is not authorized to approve customer MFA recovery.",
    );
  }

  private assertMfaNotLocked(input: { mfaLockedUntil?: Date | null }): void {
    if (input.mfaLockedUntil && input.mfaLockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `Customer MFA is temporarily locked. Try again after ${input.mfaLockedUntil.toISOString()}.`,
      );
    }
  }

  private assertChallengeCooldown(input: {
    mfaLastChallengeStartedAt?: Date | null;
  }): void {
    if (
      input.mfaLastChallengeStartedAt &&
      input.mfaLastChallengeStartedAt.getTime() +
        this.challengeStartCooldownMs >
        Date.now()
    ) {
      throw new BadRequestException(
        "Wait before starting another MFA challenge or verification code.",
      );
    }
  }

  private async recordFailedMfaAttempt(input: {
    customerId: string;
    actorId: string;
    currentFailedAttemptCount: number;
    method: CustomerMfaChallengeMethod | "totp_enrollment";
    purpose:
      | CustomerMfaChallengePurpose
      | "email_enrollment"
      | "totp_enrollment";
    challengeId?: string | null;
  }): Promise<Date | null> {
    const nextFailedAttemptCount = input.currentFailedAttemptCount + 1;
    const shouldLock = nextFailedAttemptCount >= this.maxFailedAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + this.lockoutDurationMs)
      : null;

    await this.prismaService.customer.update({
      where: { id: input.customerId },
      data: {
        mfaFailedAttemptCount: shouldLock ? 0 : nextFailedAttemptCount,
        mfaLockedUntil: lockedUntil,
      },
    });

    await this.appendAuditEvent({
      customerId: input.customerId,
      actorId: input.actorId,
      action: "customer_account.mfa_verification_failed",
      targetType: "Customer",
      metadata: {
        challengeId: input.challengeId ?? null,
        method: input.method,
        purpose: input.purpose,
        failedAttemptCount: nextFailedAttemptCount,
        lockoutApplied: shouldLock,
        lockedUntil: lockedUntil?.toISOString() ?? null,
      } as PrismaJsonValue,
    });

    if (lockedUntil) {
      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "customer_account.mfa_lockout_triggered",
        targetType: "Customer",
        metadata: {
          challengeId: input.challengeId ?? null,
          method: input.method,
          purpose: input.purpose,
          lockedUntil: lockedUntil.toISOString(),
        } as PrismaJsonValue,
      });
    }

    return lockedUntil;
  }

  private async getCustomerMfaRecordBySupabaseUserId(supabaseUserId: string) {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaTotpSecret: true,
        mfaPendingTotpSecret: true,
        mfaPendingTotpIssuedAt: true,
        mfaActiveChallenge: true,
        mfaLastVerifiedAt: true,
        mfaFailedAttemptCount: true,
        mfaLockedUntil: true,
        mfaLastChallengeStartedAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer MFA profile not found.");
    }

    return customer;
  }

  private async getCustomerMfaRecoveryTargetBySupabaseUserId(
    supabaseUserId: string,
  ) {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      include: {
        accounts: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer MFA recovery profile not found.");
    }

    return {
      customer,
      customerAccount: customer.accounts[0] ?? null,
    };
  }

  private async findCustomerMfaRecoveryRequestById(
    requestId: string,
  ): Promise<CustomerMfaRecoveryRequestRecord | null> {
    return this.prismaService.customerMfaRecoveryRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: {
          select: {
            id: true,
            supabaseUserId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        customerAccount: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  }

  async getCustomerMfaStatus(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<MfaStatusResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);

    return {
      status: "success",
      message: "Customer MFA status retrieved successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
      },
    };
  }

  async startTotpEnrollment(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<StartTotpEnrollmentResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    this.assertChallengeCooldown(customer);
    const secret = generateBase32Secret();

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaPendingTotpSecret: secret,
        mfaPendingTotpIssuedAt: new Date(),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_totp_enrollment_started",
      targetType: "Customer",
      metadata: {
        email: customer.email,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "TOTP enrollment initialized successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
        secret,
        otpAuthUri: buildOtpAuthUri(customer.email, secret),
      },
    };
  }

  async verifyTotpEnrollment(
    supabaseUserId: string,
    code: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);

    if (
      !customer.mfaPendingTotpSecret ||
      !customer.mfaPendingTotpIssuedAt ||
      customer.mfaPendingTotpIssuedAt.getTime() + this.totpEnrollmentExpiryMs <=
        Date.now()
    ) {
      throw new BadRequestException(
        "TOTP enrollment expired. Start authenticator setup again.",
      );
    }

    if (!verifyTotpCode(customer.mfaPendingTotpSecret, code.trim())) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
        method: "totp_enrollment",
        purpose: "totp_enrollment",
      });
      throw new BadRequestException(
        lockedUntil
          ? `Authenticator code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Authenticator code is invalid.",
      );
    }

    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaTotpEnrolled: true,
        mfaTotpSecret: customer.mfaPendingTotpSecret,
        mfaPendingTotpSecret: null,
        mfaPendingTotpIssuedAt: null,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
        authTokenVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        authTokenVersion: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_totp_enrolled",
      targetType: "Customer",
      metadata: {
        email: customer.email,
        revokedOtherSessions: true,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Authenticator enrolled successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
        session: await this.replaceActiveCustomerSessions(this.prismaService, {
          customerId: updatedCustomer.id,
          supabaseUserId: updatedCustomer.supabaseUserId,
          email: updatedCustomer.email,
          authTokenVersion: updatedCustomer.authTokenVersion,
          revocationReason: CustomerAuthSessionRevocationReason.mfa_enrollment,
          context,
        }),
      },
    };
  }

  async startEmailEnrollment(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<StartEmailEnrollmentResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    this.assertChallengeCooldown(customer);
    const emailOtpCode = generateEmailOtpCode();
    const challengeId = randomUUID();
    const challenge: CustomerMfaChallengeRecord = {
      id: challengeId,
      purpose: "email_enrollment",
      method: "email_otp",
      codeHash: createOtpHash(emailOtpCode),
      expiresAt: new Date(Date.now() + this.emailOtpExpiryMs).toISOString(),
      sentAt: new Date().toISOString(),
    };

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaActiveChallenge: this.serializeChallenge(challenge),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    let deliveryResult: Awaited<
      ReturnType<CustomerMfaEmailDeliveryService["sendCode"]>
    >;

    try {
      deliveryResult = await this.customerMfaEmailDeliveryService.sendCode({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        email: customer.email,
        challengeId,
        purpose: "email_enrollment",
        code: emailOtpCode,
        expiresAt: challenge.expiresAt,
      });
    } catch (error) {
      await this.prismaService.customer.update({
        where: { id: customer.id },
        data: {
          mfaActiveChallenge: Prisma.DbNull,
          mfaLastChallengeStartedAt: null,
        },
      });

      throw error;
    }

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_email_enrollment_started",
      targetType: "Customer",
      metadata: {
        challengeId,
        deliveryBackendType: deliveryResult.backendType,
        deliveryBackendReference: deliveryResult.backendReference,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Email MFA enrollment challenge created successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
        challengeId,
        expiresAt: challenge.expiresAt,
        deliveryChannel: deliveryResult.deliveryChannel,
        previewCode: deliveryResult.previewCode,
      },
    };
  }

  async verifyEmailEnrollment(
    supabaseUserId: string,
    challengeId: string,
    code: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    const challenge = this.assertChallengeActive(
      this.parseChallenge(customer.mfaActiveChallenge),
      "email_enrollment",
      "email_otp",
      challengeId,
    );

    if (
      !challenge.codeHash ||
      !otpHashMatches(code.trim(), challenge.codeHash)
    ) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
        method: "email_otp",
        purpose: "email_enrollment",
        challengeId,
      });
      throw new BadRequestException(
        lockedUntil
          ? `Email verification code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Email verification code is invalid.",
      );
    }

    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaEmailOtpEnrolled: true,
        mfaActiveChallenge: Prisma.DbNull,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
        authTokenVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        authTokenVersion: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_email_enrolled",
      targetType: "Customer",
      metadata: {
        challengeId,
        revokedOtherSessions: true,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Backup email MFA enrolled successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
        session: await this.replaceActiveCustomerSessions(this.prismaService, {
          customerId: updatedCustomer.id,
          supabaseUserId: updatedCustomer.supabaseUserId,
          email: updatedCustomer.email,
          authTokenVersion: updatedCustomer.authTokenVersion,
          revocationReason: CustomerAuthSessionRevocationReason.mfa_enrollment,
          context,
        }),
      },
    };
  }

  async startEmailRecovery(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<StartEmailEnrollmentResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);

    if (!customer.mfaEmailOtpEnrolled) {
      throw new ForbiddenException("Email backup MFA is not enrolled.");
    }

    if (!customer.mfaTotpEnrolled) {
      throw new ConflictException(
        "Authenticator MFA is not currently enrolled for this customer.",
      );
    }

    this.assertChallengeCooldown(customer);

    const emailOtpCode = generateEmailOtpCode();
    const challengeId = randomUUID();
    const challenge: CustomerMfaChallengeRecord = {
      id: challengeId,
      purpose: "email_recovery",
      method: "email_otp",
      codeHash: createOtpHash(emailOtpCode),
      expiresAt: new Date(Date.now() + this.emailOtpExpiryMs).toISOString(),
      sentAt: new Date().toISOString(),
    };

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaActiveChallenge: this.serializeChallenge(challenge),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    let deliveryResult: Awaited<
      ReturnType<CustomerMfaEmailDeliveryService["sendCode"]>
    >;

    try {
      deliveryResult = await this.customerMfaEmailDeliveryService.sendCode({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        email: customer.email,
        challengeId,
        purpose: "email_recovery",
        code: emailOtpCode,
        expiresAt: challenge.expiresAt,
      });
    } catch (error) {
      await this.prismaService.customer.update({
        where: { id: customer.id },
        data: {
          mfaActiveChallenge: Prisma.DbNull,
          mfaLastChallengeStartedAt: null,
        },
      });

      throw error;
    }

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_recovery_started",
      targetType: "Customer",
      metadata: {
        challengeId,
        deliveryBackendType: deliveryResult.backendType,
        deliveryBackendReference: deliveryResult.backendReference,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Customer MFA recovery challenge created successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
        challengeId,
        expiresAt: challenge.expiresAt,
        deliveryChannel: deliveryResult.deliveryChannel,
        previewCode: deliveryResult.previewCode,
      },
    };
  }

  async verifyEmailRecovery(
    supabaseUserId: string,
    challengeId: string,
    code: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    const challenge = this.assertChallengeActive(
      this.parseChallenge(customer.mfaActiveChallenge),
      "email_recovery",
      "email_otp",
      challengeId,
    );

    if (
      !challenge.codeHash ||
      !otpHashMatches(code.trim(), challenge.codeHash)
    ) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
        method: "email_otp",
        purpose: "email_recovery",
        challengeId,
      });

      throw new BadRequestException(
        lockedUntil
          ? `Recovery verification code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Recovery verification code is invalid.",
      );
    }

    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaTotpEnrolled: false,
        mfaTotpSecret: null,
        mfaPendingTotpSecret: null,
        mfaPendingTotpIssuedAt: null,
        mfaActiveChallenge: Prisma.DbNull,
        mfaLastVerifiedAt: null,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
        authTokenVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        authTokenVersion: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_recovery_completed",
      targetType: "Customer",
      metadata: {
        challengeId,
        recoveryMethod: "email_backup",
        revokedOtherSessions: true,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Customer MFA recovery completed successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
        session: await this.replaceActiveCustomerSessions(this.prismaService, {
          customerId: updatedCustomer.id,
          supabaseUserId: updatedCustomer.supabaseUserId,
          email: updatedCustomer.email,
          authTokenVersion: updatedCustomer.authTokenVersion,
          revocationReason: CustomerAuthSessionRevocationReason.mfa_recovery,
          context,
        }),
      },
    };
  }

  async startMfaChallenge(
    supabaseUserId: string,
    purpose: CustomerMfaChallengePurpose,
    method: CustomerMfaChallengeMethod,
  ): Promise<CustomJsonResponse<StartMfaChallengeResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    this.assertChallengeCooldown(customer);
    const status = this.buildCustomerMfaStatus(customer);
    this.assertMoneyMovementEnabled(status);

    if (
      method === "totp" &&
      (!customer.mfaTotpEnrolled || !customer.mfaTotpSecret)
    ) {
      throw new ForbiddenException("Authenticator MFA is not enrolled.");
    }

    if (method === "email_otp" && !customer.mfaEmailOtpEnrolled) {
      throw new ForbiddenException("Email backup MFA is not enrolled.");
    }

    const emailOtpCode = method === "email_otp" ? generateEmailOtpCode() : null;
    const challengeId = randomUUID();
    const challenge: CustomerMfaChallengeRecord = {
      id: challengeId,
      purpose,
      method,
      codeHash: emailOtpCode ? createOtpHash(emailOtpCode) : null,
      expiresAt: new Date(Date.now() + this.emailOtpExpiryMs).toISOString(),
      sentAt: emailOtpCode ? new Date().toISOString() : null,
    };

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaActiveChallenge: this.serializeChallenge(challenge),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    let deliveryResult: Awaited<
      ReturnType<CustomerMfaEmailDeliveryService["sendCode"]>
    > | null = null;

    if (method === "email_otp" && emailOtpCode) {
      try {
        deliveryResult = await this.customerMfaEmailDeliveryService.sendCode({
          customerId: customer.id,
          actorId: customer.supabaseUserId,
          email: customer.email,
          challengeId,
          purpose,
          code: emailOtpCode,
          expiresAt: challenge.expiresAt,
        });
      } catch (error) {
        await this.prismaService.customer.update({
          where: { id: customer.id },
          data: {
            mfaActiveChallenge: Prisma.DbNull,
            mfaLastChallengeStartedAt: null,
          },
        });

        throw error;
      }
    }

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_challenge_started",
      targetType: "Customer",
      metadata: {
        challengeId,
        purpose,
        method,
        deliveryBackendType: deliveryResult?.backendType ?? null,
        deliveryBackendReference: deliveryResult?.backendReference ?? null,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "MFA challenge started successfully.",
      data: {
        mfa: status,
        challengeId,
        method,
        purpose,
        expiresAt: challenge.expiresAt,
        previewCode: deliveryResult?.previewCode ?? null,
      },
    };
  }

  async verifyMfaChallenge(
    supabaseUserId: string,
    challengeId: string,
    purpose: CustomerMfaChallengePurpose,
    method: CustomerMfaChallengeMethod,
    code: string,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    const challenge = this.assertChallengeActive(
      this.parseChallenge(customer.mfaActiveChallenge),
      purpose,
      method,
      challengeId,
    );

    if (method === "totp") {
      if (
        !customer.mfaTotpSecret ||
        !verifyTotpCode(customer.mfaTotpSecret, code.trim())
      ) {
        const lockedUntil = await this.recordFailedMfaAttempt({
          customerId: customer.id,
          actorId: customer.supabaseUserId,
          currentFailedAttemptCount: customer.mfaFailedAttemptCount,
          method: "totp",
          purpose,
          challengeId,
        });
        throw new BadRequestException(
          lockedUntil
            ? `Authenticator code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
            : "Authenticator code is invalid.",
        );
      }
    } else if (
      !challenge.codeHash ||
      !otpHashMatches(code.trim(), challenge.codeHash)
    ) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
        method: "email_otp",
        purpose,
        challengeId,
      });
      throw new BadRequestException(
        lockedUntil
          ? `Email verification code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Email verification code is invalid.",
      );
    }

    const verifiedAt = new Date();
    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaLastVerifiedAt: verifiedAt,
        mfaActiveChallenge: Prisma.DbNull,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
      },
      select: {
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_challenge_verified",
      targetType: "Customer",
      metadata: {
        challengeId,
        purpose,
        method,
        verifiedAt: verifiedAt.toISOString(),
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "MFA challenge verified successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
      },
    };
  }

  async assertCustomerMoneyMovementEnabled(
    supabaseUserId: string,
    currentSessionId?: string | null,
  ): Promise<void> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    const sessionSecurity = this.buildCustomerSessionSecurityStatus(
      await this.getCurrentCustomerSessionRecord(
        supabaseUserId,
        currentSessionId,
      ),
    );
    this.assertCurrentSessionTrusted(sessionSecurity);
    this.assertMoneyMovementEnabled(this.buildCustomerMfaStatus(customer));
  }

  async assertCustomerStepUpFresh(
    supabaseUserId: string,
    currentSessionId?: string | null,
  ): Promise<void> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    const sessionSecurity = this.buildCustomerSessionSecurityStatus(
      await this.getCurrentCustomerSessionRecord(
        supabaseUserId,
        currentSessionId,
      ),
    );
    this.assertCurrentSessionTrusted(sessionSecurity);
    this.assertStepUpFresh(this.buildCustomerMfaStatus(customer));
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
      select: { id: true },
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
    ethereumAccountAddress: string,
  ): Promise<void> {
    try {
      await this.prismaService.user.create({
        data: {
          firstName,
          lastName,
          email,
          supabaseUserId: userId,
          ethereumAddress: ethereumAccountAddress,
        },
      });
    } catch {
      throw new InternalServerErrorException("Failed to save user profile.");
    }
  }

  private async syncCustomerWalletProjection(
    transaction: Prisma.TransactionClient,
    customerAccountId: string,
    ethereumAddress: string,
  ): Promise<void> {
    const walletLookup = {
      chainId_address: {
        chainId: this.productChainId,
        address: ethereumAddress,
      },
    } as const;

    const existingWallet = await transaction.wallet.findUnique({
      where: walletLookup,
    });

    if (
      existingWallet &&
      existingWallet.customerAccountId &&
      existingWallet.customerAccountId !== customerAccountId
    ) {
      throw new Error(
        "Wallet address is already linked to another customer account.",
      );
    }

    if (existingWallet) {
      await transaction.wallet.update({
        where: walletLookup,
        data: {
          customerAccountId,
          kind: WalletKind.embedded,
          custodyType: WalletCustodyType.platform_managed,
          status: WalletStatus.active,
        },
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
        status: WalletStatus.active,
      },
    });
  }

  private async syncCustomerAccountProjection(
    firstName: string,
    lastName: string,
    email: string,
    supabaseUserId: string,
    ethereumAddress: string,
    passwordHash: string,
  ): Promise<void> {
    try {
      await this.prismaService.$transaction(async (transaction) => {
        const customer = await transaction.customer.upsert({
          where: { email },
          update: {
            supabaseUserId,
            email,
            firstName,
            lastName,
            passwordHash,
          },
          create: {
            supabaseUserId,
            email,
            firstName,
            lastName,
            passwordHash,
          },
        });

        const customerAccount = await transaction.customerAccount.upsert({
          where: { customerId: customer.id },
          update: {},
          create: {
            customerId: customer.id,
            status: AccountLifecycleStatus.registered,
          },
        });

        await this.syncCustomerWalletProjection(
          transaction,
          customerAccount.id,
          ethereumAddress,
        );
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException(
        "Failed to initialize customer account.",
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
                take: 1,
              },
            },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      });
      const legacyUserByEmail = await transaction.user.findUnique({
        where: { email },
      });

      if (
        existingCustomer &&
        existingCustomer.supabaseUserId !== sharedLoginConfig.supabaseUserId
      ) {
        const conflictingCustomer = await transaction.customer.findUnique({
          where: { supabaseUserId: sharedLoginConfig.supabaseUserId },
          select: {
            id: true,
            email: true,
          },
        });

        if (conflictingCustomer && conflictingCustomer.email !== email) {
          throw new InternalServerErrorException(
            "Configured shared login supabase user id is already assigned to another customer.",
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
          passwordHash,
        },
        create: {
          supabaseUserId,
          email,
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          passwordHash,
        },
      });

      const customerAccount = await transaction.customerAccount.upsert({
        where: { customerId: customer.id },
        update: {},
        create: {
          customerId: customer.id,
          status: AccountLifecycleStatus.registered,
        },
      });

      await this.syncCustomerWalletProjection(
        transaction,
        customerAccount.id,
        ethereumAddress,
      );

      const legacyUser = await transaction.user.upsert({
        where: { email },
        update: {
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          email,
          supabaseUserId,
          ethereumAddress,
        },
        create: {
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          email,
          supabaseUserId,
          ethereumAddress,
        },
      });

      return {
        customerId: customer.id,
        customerAccountId: customerAccount.id,
        supabaseUserId,
        email,
        ethereumAddress,
        createdLegacyUser: legacyUserByEmail === null,
        createdCustomer: existingCustomer === null,
        createdCustomerAccount: existingCustomerAccount === null,
      };
    });
  }

  async getCustomerWalletProjectionBySupabaseUserId(
    supabaseUserId: string,
  ): Promise<CustomerWalletProjection> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: { supabaseUserId },
      },
      include: {
        wallets: {
          where: { chainId: this.productChainId },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
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
        updatedAt: wallet.updatedAt,
      },
    };
  }

  async getUserFromDatabaseById(
    supabaseUserId: string,
  ): Promise<LegacyUserRecord | null> {
    return this.prismaService.user.findFirst({
      where: { supabaseUserId },
    });
  }

  async getCustomerAccountProjectionBySupabaseUserId(
    supabaseUserId: string,
  ): Promise<CustomerAccountProjection> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        status: true,
        activatedAt: true,
        restrictedAt: true,
        frozenAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            supabaseUserId: true,
            email: true,
            firstName: true,
            lastName: true,
            passwordHash: true,
            authTokenVersion: true,
            mfaRequired: true,
            mfaTotpEnrolled: true,
            mfaEmailOtpEnrolled: true,
            mfaLastVerifiedAt: true,
            mfaLockedUntil: true,
            depositEmailNotificationsEnabled: true,
            withdrawalEmailNotificationsEnabled: true,
            loanEmailNotificationsEnabled: true,
            productUpdateEmailNotificationsEnabled: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer projection not found.");
    }

    const customer = customerAccount.customer;

    return {
      customer: {
        id: customer.id,
        supabaseUserId: customer.supabaseUserId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        passwordHash: customer.passwordHash,
        authTokenVersion: customer.authTokenVersion,
        mfaRequired: customer.mfaRequired,
        mfaTotpEnrolled: customer.mfaTotpEnrolled,
        mfaEmailOtpEnrolled: customer.mfaEmailOtpEnrolled,
        mfaLastVerifiedAt: customer.mfaLastVerifiedAt,
        mfaLockedUntil: customer.mfaLockedUntil,
        depositEmailNotificationsEnabled:
          customer.depositEmailNotificationsEnabled,
        withdrawalEmailNotificationsEnabled:
          customer.withdrawalEmailNotificationsEnabled,
        loanEmailNotificationsEnabled: customer.loanEmailNotificationsEnabled,
        productUpdateEmailNotificationsEnabled:
          customer.productUpdateEmailNotificationsEnabled,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      customerAccount: {
        id: customerAccount.id,
        status: customerAccount.status,
        activatedAt: customerAccount.activatedAt,
        restrictedAt: customerAccount.restrictedAt,
        frozenAt: customerAccount.frozenAt,
        closedAt: customerAccount.closedAt,
        createdAt: customerAccount.createdAt,
        updatedAt: customerAccount.updatedAt,
      },
    };
  }

  async validateToken(
    token: string,
  ): Promise<{ id: string; email: string; sessionId: string | null }> {
    try {
      const { jwtSecret } = loadJwtRuntimeConfig();
      const payload = jwt.verify(token, jwtSecret);

      if (typeof payload === "string") {
        throw new UnauthorizedException("Invalid or expired token.");
      }

      const sub = payload["sub"];
      const email = payload["email"];
      const authTokenVersion = payload["v"];
      const sessionId =
        typeof payload["sid"] === "string" ? payload["sid"] : null;

      if (
        typeof sub !== "string" ||
        typeof email !== "string" ||
        !Number.isInteger(authTokenVersion)
      ) {
        throw new UnauthorizedException("Invalid or expired token.");
      }

      const customer = await this.prismaService.customer.findUnique({
        where: { supabaseUserId: sub },
        select: {
          id: true,
          authTokenVersion: true,
        },
      });

      if (!customer || customer.authTokenVersion !== authTokenVersion) {
        throw new UnauthorizedException("Session is no longer valid.");
      }

      if (!sessionId) {
        return { id: sub, email, sessionId: null };
      }

      const session = await this.prismaService.customerAuthSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          customerId: true,
          tokenVersion: true,
          lastSeenAt: true,
          revokedAt: true,
        },
      });

      if (
        !session ||
        session.customerId !== customer.id ||
        session.tokenVersion !== authTokenVersion ||
        session.revokedAt
      ) {
        throw new UnauthorizedException("Session is no longer valid.");
      }

      if (session.lastSeenAt.getTime() + 15 * 60 * 1000 <= Date.now()) {
        await this.prismaService.customerAuthSession.update({
          where: { id: session.id },
          data: {
            lastSeenAt: new Date(),
          },
        });
      }

      return { id: sub, email, sessionId };
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }

  async getCurrentCustomerSessionSecurityStatus(
    supabaseUserId: string,
    currentSessionId?: string | null,
  ): Promise<CustomerSessionSecurityStatus> {
    try {
      return this.buildCustomerSessionSecurityStatus(
        await this.getCurrentCustomerSessionRecord(
          supabaseUserId,
          currentSessionId,
        ),
      );
    } catch (error) {
      if (!this.isSchemaCompatibilityError(error)) {
        throw error;
      }

      writeStructuredApiLog("warn", "customer_auth_session_unavailable", {
        supabaseUserId,
        error,
      });

      return this.buildCustomerSessionSecurityStatus(null);
    }
  }

  async startCurrentSessionTrustChallenge(
    supabaseUserId: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<StartSessionTrustChallengeResponseData>> {
    const session = await this.getCurrentCustomerSessionRecord(
      supabaseUserId,
      context?.currentSessionId,
    );
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
      },
    });

    if (!session || !customer) {
      throw new NotFoundException("Customer session profile not found.");
    }

    if (session.trustedAt) {
      throw new BadRequestException("Current session is already trusted.");
    }

    const delivery = await this.issueCustomerSessionTrustChallenge({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      email: customer.email,
      sessionId: session.id,
      context,
      existingSentAt: session.trustChallengeSentAt,
    });

    return {
      status: "success",
      message: "Session verification code sent successfully.",
      data: {
        sessionSecurity: this.buildCustomerSessionSecurityStatus(session),
        expiresAt: delivery.expiresAt,
        deliveryChannel: "email",
        previewCode: delivery.previewCode,
      },
    };
  }

  async verifyCurrentSessionTrust(
    supabaseUserId: string,
    currentSessionId: string | null | undefined,
    code: string,
  ): Promise<CustomJsonResponse<SessionTrustStatusResponseData>> {
    const session = await this.getCurrentCustomerSessionRecord(
      supabaseUserId,
      currentSessionId,
    );
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
      },
    });

    if (!session || !customer) {
      throw new NotFoundException("Customer session profile not found.");
    }

    if (session.trustedAt) {
      return {
        status: "success",
        message: "Current session is already trusted.",
        data: {
          sessionSecurity: this.buildCustomerSessionSecurityStatus(session),
        },
      };
    }

    if (
      !session.trustChallengeCodeHash ||
      !session.trustChallengeExpiresAt ||
      session.trustChallengeExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        "Session verification expired. Send a new code.",
      );
    }

    if (!otpHashMatches(code.trim(), session.trustChallengeCodeHash)) {
      throw new BadRequestException("Session verification code is invalid.");
    }

    const trustedAt = new Date();
    const updatedSession = await this.prismaService.customerAuthSession.update({
      where: { id: session.id },
      data: {
        trustedAt,
        trustChallengeCodeHash: null,
        trustChallengeExpiresAt: null,
        trustChallengeSentAt: null,
      },
      select: {
        id: true,
        tokenVersion: true,
        clientPlatform: true,
        trustedAt: true,
        trustChallengeCodeHash: true,
        trustChallengeExpiresAt: true,
        trustChallengeSentAt: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
        customerId: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.session_trusted",
      targetType: "CustomerAuthSession",
      targetId: session.id,
      metadata: {
        sessionId: session.id,
        method: "email_otp",
        clientPlatform: updatedSession.clientPlatform,
        userAgent: updatedSession.userAgent,
        ipAddress: updatedSession.ipAddress,
        trustedAt: trustedAt.toISOString(),
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Current session verified successfully.",
      data: {
        sessionSecurity:
          this.buildCustomerSessionSecurityStatus(updatedSession),
      },
    };
  }

  async updatePassword(
    supabaseUserId: string,
    currentPassword: string,
    newPassword: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<UpdatePasswordResponseData>> {
    if (newPassword === currentPassword) {
      throw new BadRequestException(
        "New password must be different from the current password.",
      );
    }

    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        passwordHash: true,
        authTokenVersion: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    if (!customer?.passwordHash) {
      throw new BadRequestException(
        "Password rotation is not available for this account.",
      );
    }

    this.assertCurrentSessionTrusted(
      this.buildCustomerSessionSecurityStatus(
        await this.getCurrentCustomerSessionRecord(
          supabaseUserId,
          context?.currentSessionId,
        ),
      ),
    );
    this.assertStepUpFresh(this.buildCustomerMfaStatus(customer));

    const passwordValid = await bcrypt.compare(
      currentPassword,
      customer.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, 12);

    const rotatedSession = await this.prismaService.$transaction(
      async (transaction) => {
        await transaction.customer.update({
          where: { id: customer.id },
          data: {
            passwordHash: nextPasswordHash,
          },
        });

        const nextSession = await this.rotateCustomerSession(transaction, {
          customerId: customer.id,
          supabaseUserId: customer.supabaseUserId,
          email: customer.email,
          revocationReason:
            CustomerAuthSessionRevocationReason.password_rotation,
          context,
        });

        await transaction.auditEvent.create({
          data: {
            customerId: customer.id,
            actorType: "customer",
            actorId: customer.supabaseUserId,
            action: "customer_account.password_rotated",
            targetType: "Customer",
            targetId: customer.id,
            metadata: {
              passwordRotationAvailable: true,
              revokedOtherSessions: true,
            } as PrismaJsonValue,
          },
        });
        return nextSession;
      },
    );

    return {
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true,
        session: rotatedSession,
      },
    };
  }

  async revokeAllCustomerSessions(
    supabaseUserId: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<RevokeCustomerSessionsResponseData>> {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer session profile not found.");
    }

    const nextSession = await this.prismaService.$transaction(
      async (transaction) =>
        this.rotateCustomerSession(transaction, {
          customerId: customer.id,
          supabaseUserId: customer.supabaseUserId,
          email: customer.email,
          revocationReason: CustomerAuthSessionRevocationReason.revoke_all,
          context,
        }),
    );

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.sessions_revoked",
      targetType: "Customer",
      metadata: {
        revokedOtherSessions: true,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Customer sessions revoked successfully.",
      data: {
        session: nextSession,
      },
    };
  }

  async listCustomerSessions(
    supabaseUserId: string,
    currentSessionId?: string | null,
  ): Promise<CustomJsonResponse<ListCustomerSessionsResponseData>> {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer session profile not found.");
    }

    const sessions = await this.prismaService.customerAuthSession.findMany({
      where: {
        customerId: customer.id,
        revokedAt: null,
      },
      select: {
        id: true,
        customerId: true,
        tokenVersion: true,
        clientPlatform: true,
        trustedAt: true,
        trustChallengeCodeHash: true,
        trustChallengeExpiresAt: true,
        trustChallengeSentAt: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
      },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    });

    return {
      status: "success",
      message: "Customer sessions retrieved successfully.",
      data: {
        sessions: sessions.map((session) =>
          this.mapCustomerSession(session, currentSessionId),
        ),
        activeSessionCount: sessions.length,
      },
    };
  }

  async listCustomerSecurityActivity(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<ListCustomerSecurityActivityResponseData>> {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer security profile not found.");
    }

    const actions = [
      "customer_account.session_created",
      "customer_account.session_trusted",
      "customer_account.session_revoked",
      "customer_account.sessions_revoked",
      "customer_account.password_rotated",
      "customer_account.mfa_totp_enrolled",
      "customer_account.mfa_email_enrolled",
      "customer_account.mfa_recovery_completed",
      "customer_account.mfa_challenge_verified",
    ] as const;
    const limit = 20;

    const [events, totalCount] = await Promise.all([
      this.prismaService.auditEvent.findMany({
        where: {
          customerId: customer.id,
          action: {
            in: [...actions],
          },
        },
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      }),
      this.prismaService.auditEvent.count({
        where: {
          customerId: customer.id,
          action: {
            in: [...actions],
          },
        },
      }),
    ]);

    return {
      status: "success",
      message: "Customer security activity retrieved successfully.",
      data: {
        events: events
          .map((event) => this.mapCustomerSecurityActivity(event))
          .filter(
            (event): event is CustomerSecurityActivityProjection =>
              event !== null,
          ),
        limit,
        totalCount,
      },
    };
  }

  async revokeCustomerSession(
    supabaseUserId: string,
    currentSessionId: string | null,
    targetSessionId: string,
  ): Promise<CustomJsonResponse<RevokeCustomerSessionResponseData>> {
    if (!currentSessionId) {
      throw new ConflictException(
        "This session must be refreshed before individual session revocation is available.",
      );
    }

    if (currentSessionId === targetSessionId) {
      throw new ConflictException(
        "Use revoke-all session rotation instead of revoking the current session directly.",
      );
    }

    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer session profile not found.");
    }

    const targetSession =
      await this.prismaService.customerAuthSession.findUnique({
        where: { id: targetSessionId },
        select: {
          id: true,
          customerId: true,
          revokedAt: true,
        },
      });

    if (!targetSession || targetSession.customerId !== customer.id) {
      throw new NotFoundException("Customer session was not found.");
    }

    if (targetSession.revokedAt) {
      return {
        status: "success",
        message: "Customer session revoked successfully.",
        data: {
          revokedSessionId: targetSession.id,
          activeSessionCount:
            await this.prismaService.customerAuthSession.count({
              where: {
                customerId: customer.id,
                revokedAt: null,
              },
            }),
        },
      };
    }

    await this.prismaService.$transaction(async (transaction) => {
      await transaction.customerAuthSession.update({
        where: { id: targetSession.id },
        data: {
          revokedAt: new Date(),
          revokedReason: CustomerAuthSessionRevocationReason.session_revoked,
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: customer.id,
          actorType: "customer",
          actorId: customer.supabaseUserId,
          action: "customer_account.session_revoked",
          targetType: "CustomerAuthSession",
          targetId: targetSession.id,
          metadata: {
            revokedSessionId: targetSession.id,
            currentSessionId,
          } as PrismaJsonValue,
        },
      });
    });

    const activeSessionCount =
      await this.prismaService.customerAuthSession.count({
        where: {
          customerId: customer.id,
          revokedAt: null,
        },
      });

    return {
      status: "success",
      message: "Customer session revoked successfully.",
      data: {
        revokedSessionId: targetSession.id,
        activeSessionCount,
      },
    };
  }

  async listCustomerSessionRisks(
    query: {
      limit?: number;
      clientPlatform?: "web" | "mobile" | "unknown";
      challengeState?: CustomerSessionRiskChallengeState;
    },
    operatorRole?: string | null,
  ): Promise<ListCustomerSessionRisksResult> {
    assertOperatorRoleAuthorized(
      operatorRole,
      this.sessionRiskReadAllowedOperatorRoles,
      "You are not authorized to view customer session risk.",
    );

    const now = new Date();
    const limit = Math.min(query.limit ?? 25, 100);
    const where: Prisma.CustomerAuthSessionWhereInput = {
      revokedAt: null,
      trustedAt: null,
      ...(query.clientPlatform ? { clientPlatform: query.clientPlatform } : {}),
    };

    if (query.challengeState === "pending") {
      where.trustChallengeCodeHash = {
        not: null,
      };
      where.trustChallengeExpiresAt = {
        gt: now,
      };
    } else if (query.challengeState === "expired") {
      where.trustChallengeCodeHash = {
        not: null,
      };
      where.trustChallengeExpiresAt = {
        lte: now,
      };
    } else if (query.challengeState === "not_started") {
      where.OR = [
        {
          trustChallengeCodeHash: null,
        },
        {
          trustChallengeExpiresAt: null,
        },
      ];
    }

    const [
      sessions,
      totalCount,
      pendingCount,
      expiredCount,
      webCount,
      mobileCount,
      unknownCount,
      activeSessionCounts,
      activeUntrustedSessionCounts,
    ] = await Promise.all([
      this.prismaService.customerAuthSession.findMany({
        where,
        select: {
          id: true,
          clientPlatform: true,
          trustedAt: true,
          trustChallengeCodeHash: true,
          trustChallengeExpiresAt: true,
          trustChallengeSentAt: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastSeenAt: true,
          revokedAt: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              supabaseUserId: true,
              email: true,
              firstName: true,
              lastName: true,
              accounts: {
                select: {
                  id: true,
                  status: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      this.prismaService.customerAuthSession.count({
        where,
      }),
      this.prismaService.customerAuthSession.count({
        where: {
          ...where,
          trustChallengeCodeHash: {
            not: null,
          },
          trustChallengeExpiresAt: {
            gt: now,
          },
        },
      }),
      this.prismaService.customerAuthSession.count({
        where: {
          ...where,
          trustChallengeCodeHash: {
            not: null,
          },
          trustChallengeExpiresAt: {
            lte: now,
          },
        },
      }),
      this.prismaService.customerAuthSession.count({
        where: {
          ...where,
          clientPlatform: CustomerAuthSessionPlatform.web,
        },
      }),
      this.prismaService.customerAuthSession.count({
        where: {
          ...where,
          clientPlatform: CustomerAuthSessionPlatform.mobile,
        },
      }),
      this.prismaService.customerAuthSession.count({
        where: {
          ...where,
          clientPlatform: CustomerAuthSessionPlatform.unknown,
        },
      }),
      this.prismaService.customerAuthSession.groupBy({
        by: ["customerId"],
        where: {
          revokedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.customerAuthSession.groupBy({
        by: ["customerId"],
        where: {
          revokedAt: null,
          trustedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const customerAccountIds = sessions
      .map((session) => session.customer.accounts[0]?.id ?? null)
      .filter((value): value is string => Boolean(value));
    const linkedReviewCases = customerAccountIds.length
      ? await this.prismaService.reviewCase.findMany({
          where: {
            customerAccountId: {
              in: customerAccountIds,
            },
            type: ReviewCaseType.account_review,
            reasonCode: "session_risk_anomaly",
            status: {
              in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress],
            },
          },
          select: {
            id: true,
            customerAccountId: true,
            type: true,
            status: true,
            assignedOperatorId: true,
            updatedAt: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        })
      : [];
    const linkedReviewCaseByAccountId = linkedReviewCases.reduce(
      (map, reviewCase) => {
        if (!reviewCase.customerAccountId) {
          return map;
        }

        if (!map.has(reviewCase.customerAccountId)) {
          map.set(reviewCase.customerAccountId, reviewCase);
        }

        return map;
      },
      new Map<string, (typeof linkedReviewCases)[number]>(),
    );
    const activeSessionCountByCustomerId = new Map(
      activeSessionCounts.map((entry) => [entry.customerId, entry._count._all]),
    );
    const activeUntrustedSessionCountByCustomerId = new Map(
      activeUntrustedSessionCounts.map((entry) => [
        entry.customerId,
        entry._count._all,
      ]),
    );
    const scoredSessions = sessions.map((session) => {
      const assessment = this.assessCustomerSessionRisk({
        session,
        activeUntrustedSessionCountForCustomer:
          activeUntrustedSessionCountByCustomerId.get(session.customerId) ?? 1,
        activeSessionCountForCustomer:
          activeSessionCountByCustomerId.get(session.customerId) ?? 1,
      });

      return this.mapCustomerSessionRisk(
        session,
        assessment,
        linkedReviewCaseByAccountId.get(
          session.customer.accounts[0]?.id ?? "",
        ) ?? null,
      );
    });
    const criticalCount = scoredSessions.filter(
      (session) => session.riskSeverity === "critical",
    ).length;

    return {
      sessions: scoredSessions,
      limit,
      totalCount,
      summary: {
        byChallengeState: [
          {
            challengeState: "pending",
            count: pendingCount,
          },
          {
            challengeState: "expired",
            count: expiredCount,
          },
          {
            challengeState: "not_started",
            count: Math.max(totalCount - pendingCount - expiredCount, 0),
          },
        ],
        byPlatform: [
          {
            clientPlatform: "web",
            count: webCount,
          },
          {
            clientPlatform: "mobile",
            count: mobileCount,
          },
          {
            clientPlatform: "unknown",
            count: unknownCount,
          },
        ],
        bySeverity: [
          {
            riskSeverity: "critical",
            count: criticalCount,
          },
          {
            riskSeverity: "warning",
            count: Math.max(scoredSessions.length - criticalCount, 0),
          },
        ],
      },
    };
  }

  async revokeCustomerSessionRisk(
    sessionId: string,
    operatorId: string,
    operatorRole?: string | null,
    note?: string | null,
  ): Promise<CustomerSessionRiskMutationResult> {
    const normalizedOperatorRole = assertOperatorRoleAuthorized(
      operatorRole,
      this.sessionRiskRevokeAllowedOperatorRoles,
      "You are not authorized to revoke risky customer sessions.",
    );

    const targetSession =
      await this.prismaService.customerAuthSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          clientPlatform: true,
          trustedAt: true,
          trustChallengeCodeHash: true,
          trustChallengeExpiresAt: true,
          trustChallengeSentAt: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastSeenAt: true,
          revokedAt: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              supabaseUserId: true,
              email: true,
              firstName: true,
              lastName: true,
              accounts: {
                select: {
                  id: true,
                  status: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
                take: 1,
              },
            },
          },
        },
      });

    if (!targetSession) {
      throw new NotFoundException("Customer risky session was not found.");
    }

    if (targetSession.trustedAt) {
      throw new BadRequestException(
        "Only active untrusted sessions can be revoked from the session risk queue.",
      );
    }

    if (targetSession.revokedAt) {
      const assessment = this.assessCustomerSessionRisk({
        session: targetSession,
        activeUntrustedSessionCountForCustomer: 1,
        activeSessionCountForCustomer: 1,
      });
      return {
        session: this.mapCustomerSessionRisk(targetSession, assessment),
        stateReused: true,
      };
    }

    const revokedAt = new Date();
    const normalizedNote = this.normalizeOptionalText(note);

    const updatedSession = await this.prismaService.$transaction(
      async (transaction) => {
        const session = await transaction.customerAuthSession.update({
          where: { id: sessionId },
          data: {
            revokedAt,
            revokedReason: CustomerAuthSessionRevocationReason.session_revoked,
          },
          select: {
            id: true,
            clientPlatform: true,
            trustedAt: true,
            trustChallengeCodeHash: true,
            trustChallengeExpiresAt: true,
            trustChallengeSentAt: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
            lastSeenAt: true,
            revokedAt: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true,
                accounts: {
                  select: {
                    id: true,
                    status: true,
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                  take: 1,
                },
              },
            },
          },
        });

        await transaction.auditEvent.create({
          data: {
            customerId: targetSession.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.session_revoked",
            targetType: "CustomerAuthSession",
            targetId: session.id,
            metadata: {
              revokedSessionId: session.id,
              operatorAction: "customer_session_risk_revoke",
              operatorRole: normalizedOperatorRole,
              clientPlatform: session.clientPlatform,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              note: normalizedNote,
            } as PrismaJsonValue,
          },
        });

        return session;
      },
    );

    return {
      session: this.mapCustomerSessionRisk(
        updatedSession,
        this.assessCustomerSessionRisk({
          session: updatedSession,
          activeUntrustedSessionCountForCustomer: 1,
          activeSessionCountForCustomer: 1,
        }),
      ),
      stateReused: false,
    };
  }

  async escalateCustomerSessionRisk(
    sessionId: string,
    operatorId: string,
    operatorRole?: string | null,
    note?: string | null,
  ): Promise<CustomerSessionRiskEscalationMutationResult> {
    const normalizedOperatorRole = assertOperatorRoleAuthorized(
      operatorRole,
      this.sessionRiskEscalationAllowedOperatorRoles,
      "You are not authorized to escalate risky customer sessions.",
    );

    const targetSession =
      await this.prismaService.customerAuthSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          clientPlatform: true,
          trustedAt: true,
          trustChallengeCodeHash: true,
          trustChallengeExpiresAt: true,
          trustChallengeSentAt: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastSeenAt: true,
          revokedAt: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              supabaseUserId: true,
              email: true,
              firstName: true,
              lastName: true,
              accounts: {
                select: {
                  id: true,
                  status: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
                take: 1,
              },
            },
          },
        },
      });

    if (!targetSession) {
      throw new NotFoundException("Customer risky session was not found.");
    }

    if (targetSession.trustedAt) {
      throw new BadRequestException(
        "Trusted sessions do not support escalation from the session risk queue.",
      );
    }

    const customerAccount = targetSession.customer.accounts[0] ?? null;

    if (!customerAccount) {
      throw new NotFoundException(
        "Customer account was not found for the risky session.",
      );
    }

    const [
      activeSessionCountForCustomer,
      activeUntrustedSessionCountForCustomer,
    ] = await Promise.all([
      this.prismaService.customerAuthSession.count({
        where: {
          customerId: targetSession.customerId,
          revokedAt: null,
        },
      }),
      this.prismaService.customerAuthSession.count({
        where: {
          customerId: targetSession.customerId,
          revokedAt: null,
          trustedAt: null,
        },
      }),
    ]);

    const assessment = this.assessCustomerSessionRisk({
      session: targetSession,
      activeSessionCountForCustomer,
      activeUntrustedSessionCountForCustomer,
    });
    const normalizedNote = this.normalizeOptionalText(note);
    const reviewCaseResult =
      await this.reviewCasesService.openOrReuseReviewCase(this.prismaService, {
        customerId: targetSession.customer.id,
        customerAccountId: customerAccount.id,
        transactionIntentId: null,
        type: ReviewCaseType.account_review,
        reasonCode: "session_risk_anomaly",
        notes:
          normalizedNote ??
          `Session risk escalation for ${targetSession.customer.email}: ${assessment.riskReasons.join(
            ", ",
          )}.`,
        actorType: "operator",
        actorId: operatorId,
        auditAction: "review_case.account_review.opened",
        auditMetadata: {
          escalationSource: "customer_session_risk",
          sessionId: targetSession.id,
          riskSeverity: assessment.riskSeverity,
          riskScore: assessment.riskScore,
          riskReasons: assessment.riskReasons,
          recommendedAction: assessment.recommendedAction,
          operatorRole: normalizedOperatorRole,
          clientPlatform: targetSession.clientPlatform,
          ipAddress: targetSession.ipAddress,
          userAgent: targetSession.userAgent,
          challengeState:
            this.resolveCustomerSessionRiskChallengeState(targetSession),
        },
      });

    await this.appendOperatorAuditEvent({
      customerId: targetSession.customer.id,
      actorId: operatorId,
      action: "customer_account.session_risk_escalated",
      targetType: "CustomerAuthSession",
      targetId: targetSession.id,
      metadata: {
        operatorRole: normalizedOperatorRole,
        reviewCaseId: reviewCaseResult.reviewCase.id,
        reviewCaseReused: reviewCaseResult.reviewCaseReused,
        riskSeverity: assessment.riskSeverity,
        riskScore: assessment.riskScore,
        riskReasons: assessment.riskReasons,
        note: normalizedNote,
      } as PrismaJsonValue,
    });

    return {
      session: this.mapCustomerSessionRisk(targetSession, assessment, {
        id: reviewCaseResult.reviewCase.id,
        type: reviewCaseResult.reviewCase.type,
        status: reviewCaseResult.reviewCase.status,
        assignedOperatorId: reviewCaseResult.reviewCase.assignedOperatorId,
        updatedAt: new Date(reviewCaseResult.reviewCase.updatedAt),
      }),
      reviewCase: {
        id: reviewCaseResult.reviewCase.id,
        type: reviewCaseResult.reviewCase.type,
        status: reviewCaseResult.reviewCase.status,
        reasonCode: reviewCaseResult.reviewCase.reasonCode,
        assignedOperatorId: reviewCaseResult.reviewCase.assignedOperatorId,
        updatedAt: reviewCaseResult.reviewCase.updatedAt,
      },
      reviewCaseReused: reviewCaseResult.reviewCaseReused,
    };
  }

  async listCustomerMfaRecoveryRequests(query: {
    limit?: number;
    status?: CustomerMfaRecoveryRequestStatus;
    requestType?: CustomerMfaRecoveryRequestType;
  }): Promise<ListCustomerMfaRecoveryRequestsResult> {
    const limit = query.limit ?? 25;
    const where: Prisma.CustomerMfaRecoveryRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.requestType ? { requestType: query.requestType } : {}),
    };

    const [requests, totalCount, byStatus] = await Promise.all([
      this.prismaService.customerMfaRecoveryRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              supabaseUserId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          customerAccount: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      this.prismaService.customerMfaRecoveryRequest.count({ where }),
      this.prismaService.customerMfaRecoveryRequest.groupBy({
        by: ["status"],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    return {
      requests: requests.map((request) =>
        this.mapCustomerMfaRecoveryRequest(request),
      ),
      limit,
      totalCount,
      summary: {
        byStatus: byStatus.map((entry) => ({
          status: entry.status,
          count: entry._count._all,
        })),
      },
    };
  }

  async requestCustomerMfaRecovery(
    supabaseUserId: string,
    operatorId: string,
    operatorRole: string | null,
    dto: {
      requestType: CustomerMfaRecoveryRequestType;
      note?: string | null;
    },
  ): Promise<CustomerMfaRecoveryRequestMutationResult> {
    const normalizedOperatorRole =
      this.assertCanRequestCustomerMfaRecovery(operatorRole);
    const target =
      await this.getCustomerMfaRecoveryTargetBySupabaseUserId(supabaseUserId);
    const normalizedRequestNote = dto.note?.trim() || null;

    if (dto.requestType === CustomerMfaRecoveryRequestType.release_lockout) {
      if (
        !target.customer.mfaLockedUntil &&
        target.customer.mfaFailedAttemptCount <= 0
      ) {
        throw new ConflictException(
          "Customer MFA is not currently locked or pending failed-attempt release.",
        );
      }
    } else if (
      !target.customer.mfaTotpEnrolled &&
      !target.customer.mfaEmailOtpEnrolled &&
      !target.customer.mfaTotpSecret &&
      !target.customer.mfaPendingTotpSecret &&
      !target.customer.mfaActiveChallenge &&
      !target.customer.mfaLockedUntil &&
      target.customer.mfaFailedAttemptCount <= 0
    ) {
      throw new ConflictException(
        "Customer MFA does not currently have any active factor or lockout state to reset.",
      );
    }

    const existingRequest =
      await this.prismaService.customerMfaRecoveryRequest.findFirst({
        where: {
          customerId: target.customer.id,
          requestType: dto.requestType,
          status: {
            in: [
              CustomerMfaRecoveryRequestStatus.pending_approval,
              CustomerMfaRecoveryRequestStatus.approved,
            ],
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              supabaseUserId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          customerAccount: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: {
          requestedAt: "desc",
        },
      });

    if (existingRequest) {
      if (existingRequest.requestedByOperatorId !== operatorId) {
        throw new ConflictException(
          "A governed customer MFA recovery request already exists for this customer and recovery type.",
        );
      }

      return {
        request: this.mapCustomerMfaRecoveryRequest(existingRequest),
        stateReused: true,
      };
    }

    const createdRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.customerMfaRecoveryRequest.create(
          {
            data: {
              customerId: target.customer.id,
              customerAccountId: target.customerAccount?.id,
              requestType: dto.requestType,
              status: CustomerMfaRecoveryRequestStatus.pending_approval,
              requestedByOperatorId: operatorId,
              requestedByOperatorRole: normalizedOperatorRole,
              requestNote: normalizedRequestNote ?? undefined,
            },
            include: {
              customer: {
                select: {
                  id: true,
                  supabaseUserId: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              customerAccount: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        );

        await transaction.auditEvent.create({
          data: {
            customerId: target.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.mfa_recovery_requested",
            targetType: "CustomerMfaRecoveryRequest",
            targetId: nextRequest.id,
            metadata: {
              requestType: dto.requestType,
              operatorRole: normalizedOperatorRole,
              requestNote: normalizedRequestNote,
              currentLockoutUntil:
                target.customer.mfaLockedUntil?.toISOString() ?? null,
              currentFailedAttemptCount: target.customer.mfaFailedAttemptCount,
              totpEnrolled: target.customer.mfaTotpEnrolled,
              emailOtpEnrolled: target.customer.mfaEmailOtpEnrolled,
            } as PrismaJsonValue,
          },
        });

        return nextRequest;
      },
    );

    return {
      request: this.mapCustomerMfaRecoveryRequest(createdRequest),
      stateReused: false,
    };
  }

  async approveCustomerMfaRecoveryRequest(
    requestId: string,
    operatorId: string,
    operatorRole: string | null,
    note?: string | null,
  ): Promise<CustomerMfaRecoveryRequestMutationResult> {
    const normalizedOperatorRole =
      this.assertCanApproveCustomerMfaRecovery(operatorRole);
    const request = await this.findCustomerMfaRecoveryRequestById(requestId);

    if (!request) {
      throw new NotFoundException(
        "Customer MFA recovery request was not found.",
      );
    }

    if (request.status === CustomerMfaRecoveryRequestStatus.approved) {
      return {
        request: this.mapCustomerMfaRecoveryRequest(request),
        stateReused: true,
      };
    }

    if (request.status !== CustomerMfaRecoveryRequestStatus.pending_approval) {
      throw new ConflictException(
        "Only pending customer MFA recovery requests can be approved.",
      );
    }

    if (request.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Customer MFA recovery requires a different approver than the requester.",
      );
    }

    const normalizedApprovalNote = note?.trim() || null;
    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.customerMfaRecoveryRequest.update(
          {
            where: { id: request.id },
            data: {
              status: CustomerMfaRecoveryRequestStatus.approved,
              approvedByOperatorId: operatorId,
              approvedByOperatorRole: normalizedOperatorRole,
              approvalNote: normalizedApprovalNote ?? undefined,
              approvedAt: new Date(),
              rejectedByOperatorId: null,
              rejectedByOperatorRole: null,
              rejectionNote: null,
              rejectedAt: null,
            },
            include: {
              customer: {
                select: {
                  id: true,
                  supabaseUserId: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              customerAccount: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        );

        await transaction.auditEvent.create({
          data: {
            customerId: request.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.mfa_recovery_approved",
            targetType: "CustomerMfaRecoveryRequest",
            targetId: nextRequest.id,
            metadata: {
              requestType: request.requestType,
              requestedByOperatorId: request.requestedByOperatorId,
              requestedByOperatorRole: request.requestedByOperatorRole,
              approvedByOperatorId: operatorId,
              approvedByOperatorRole: normalizedOperatorRole,
              approvalNote: normalizedApprovalNote,
            } as PrismaJsonValue,
          },
        });

        return nextRequest;
      },
    );

    return {
      request: this.mapCustomerMfaRecoveryRequest(updatedRequest),
      stateReused: false,
    };
  }

  async rejectCustomerMfaRecoveryRequest(
    requestId: string,
    operatorId: string,
    operatorRole: string | null,
    note: string,
  ): Promise<CustomerMfaRecoveryRequestMutationResult> {
    const normalizedOperatorRole =
      this.assertCanApproveCustomerMfaRecovery(operatorRole);
    const request = await this.findCustomerMfaRecoveryRequestById(requestId);

    if (!request) {
      throw new NotFoundException(
        "Customer MFA recovery request was not found.",
      );
    }

    if (request.status === CustomerMfaRecoveryRequestStatus.rejected) {
      return {
        request: this.mapCustomerMfaRecoveryRequest(request),
        stateReused: true,
      };
    }

    if (request.status !== CustomerMfaRecoveryRequestStatus.pending_approval) {
      throw new ConflictException(
        "Only pending customer MFA recovery requests can be rejected.",
      );
    }

    if (request.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Customer MFA recovery requires a different reviewer than the requester.",
      );
    }

    const normalizedRejectionNote = note.trim();

    if (!normalizedRejectionNote) {
      throw new ConflictException(
        "A rejection note is required to reject a customer MFA recovery request.",
      );
    }

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.customerMfaRecoveryRequest.update(
          {
            where: { id: request.id },
            data: {
              status: CustomerMfaRecoveryRequestStatus.rejected,
              rejectedByOperatorId: operatorId,
              rejectedByOperatorRole: normalizedOperatorRole,
              rejectionNote: normalizedRejectionNote,
              rejectedAt: new Date(),
            },
            include: {
              customer: {
                select: {
                  id: true,
                  supabaseUserId: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              customerAccount: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        );

        await transaction.auditEvent.create({
          data: {
            customerId: request.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.mfa_recovery_rejected",
            targetType: "CustomerMfaRecoveryRequest",
            targetId: nextRequest.id,
            metadata: {
              requestType: request.requestType,
              requestedByOperatorId: request.requestedByOperatorId,
              requestedByOperatorRole: request.requestedByOperatorRole,
              rejectedByOperatorId: operatorId,
              rejectedByOperatorRole: normalizedOperatorRole,
              rejectionNote: normalizedRejectionNote,
            } as PrismaJsonValue,
          },
        });

        return nextRequest;
      },
    );

    return {
      request: this.mapCustomerMfaRecoveryRequest(updatedRequest),
      stateReused: false,
    };
  }

  async executeCustomerMfaRecoveryRequest(
    requestId: string,
    operatorId: string,
    operatorRole: string | null,
    note?: string | null,
  ): Promise<CustomerMfaRecoveryRequestMutationResult> {
    const normalizedOperatorRole =
      this.assertCanRequestCustomerMfaRecovery(operatorRole);
    const request = await this.findCustomerMfaRecoveryRequestById(requestId);

    if (!request) {
      throw new NotFoundException(
        "Customer MFA recovery request was not found.",
      );
    }

    if (request.status === CustomerMfaRecoveryRequestStatus.executed) {
      return {
        request: this.mapCustomerMfaRecoveryRequest(request),
        stateReused: true,
      };
    }

    if (request.status !== CustomerMfaRecoveryRequestStatus.approved) {
      throw new ConflictException(
        "Customer MFA recovery request must be approved before execution.",
      );
    }

    if (request.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Customer MFA recovery execution requires a different operator than the requester.",
      );
    }

    const normalizedExecutionNote = note?.trim() || null;

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        await transaction.customer.update({
          where: { id: request.customer.id },
          data:
            request.requestType ===
            CustomerMfaRecoveryRequestType.release_lockout
              ? {
                  mfaActiveChallenge: Prisma.DbNull,
                  mfaLastVerifiedAt: null,
                  mfaFailedAttemptCount: 0,
                  mfaLockedUntil: null,
                  mfaLastChallengeStartedAt: null,
                  authTokenVersion: {
                    increment: 1,
                  },
                }
              : {
                  mfaTotpEnrolled: false,
                  mfaEmailOtpEnrolled: false,
                  mfaTotpSecret: null,
                  mfaPendingTotpSecret: null,
                  mfaPendingTotpIssuedAt: null,
                  mfaActiveChallenge: Prisma.DbNull,
                  mfaLastVerifiedAt: null,
                  mfaFailedAttemptCount: 0,
                  mfaLockedUntil: null,
                  mfaLastChallengeStartedAt: null,
                  authTokenVersion: {
                    increment: 1,
                  },
                },
        });

        await transaction.customerAuthSession.updateMany({
          where: {
            customerId: request.customer.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokedReason:
              CustomerAuthSessionRevocationReason.operator_mfa_recovery,
          },
        });

        const nextRequest = await transaction.customerMfaRecoveryRequest.update(
          {
            where: { id: request.id },
            data: {
              status: CustomerMfaRecoveryRequestStatus.executed,
              executedByOperatorId: operatorId,
              executedByOperatorRole: normalizedOperatorRole,
              executionNote: normalizedExecutionNote ?? undefined,
              executedAt: new Date(),
            },
            include: {
              customer: {
                select: {
                  id: true,
                  supabaseUserId: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              customerAccount: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        );

        await transaction.auditEvent.create({
          data: {
            customerId: request.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.mfa_recovery_executed",
            targetType: "CustomerMfaRecoveryRequest",
            targetId: nextRequest.id,
            metadata: {
              requestType: request.requestType,
              requestedByOperatorId: request.requestedByOperatorId,
              requestedByOperatorRole: request.requestedByOperatorRole,
              approvedByOperatorId: request.approvedByOperatorId,
              approvedByOperatorRole: request.approvedByOperatorRole,
              executedByOperatorId: operatorId,
              executedByOperatorRole: normalizedOperatorRole,
              executionNote: normalizedExecutionNote,
              revokedOtherSessions: true,
            } as PrismaJsonValue,
          },
        });

        return nextRequest;
      },
    );

    return {
      request: this.mapCustomerMfaRecoveryRequest(updatedRequest),
      stateReused: false,
    };
  }

  async signUp(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
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
      generatedEthereumAddress.address,
    );

    await this.syncCustomerAccountProjection(
      firstName,
      lastName,
      normalizedEmail,
      authUserId,
      generatedEthereumAddress.address,
      passwordHash,
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
          ethereumAddress: generatedEthereumAddress.address,
        },
      },
    };
  }

  async login(
    email: string,
    password: string,
    context?: CustomerSessionContext,
  ): Promise<CustomJsonResponse<LoginResponseData>> {
    const normalizedEmail = this.normalizeEmail(email);
    const customer = await this.prismaService.customer.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        passwordHash: true,
        authTokenVersion: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
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

    const { recognizedSessionSignature, sessionId } =
      await this.createLoginSession({
        customerId: customer.id,
        tokenVersion: customer.authTokenVersion,
        context,
      });
    const sessionSecurity = this.buildCustomerSessionSecurityStatus({
      trustedAt: recognizedSessionSignature || !sessionId ? new Date() : null,
    });
    const token = this.signToken(
      customer.supabaseUserId,
      customer.email,
      customer.authTokenVersion,
      sessionId,
    );

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.session_created",
      targetType: "Customer",
      metadata: {
        clientPlatform: this.normalizeSessionPlatform(context?.clientPlatform),
        userAgent: this.normalizeOptionalText(context?.userAgent),
        ipAddress: this.normalizeOptionalText(context?.ipAddress),
      } as PrismaJsonValue,
    });

    if (!recognizedSessionSignature && sessionId) {
      void this.customerSecurityEmailDeliveryService
        .sendSessionAlert({
          customerId: customer.id,
          actorId: customer.supabaseUserId,
          email: customer.email,
          purpose: "new_session_login",
          clientPlatform: this.normalizeSessionPlatform(
            context?.clientPlatform,
          ),
          userAgent: this.normalizeOptionalText(context?.userAgent),
          ipAddress: this.normalizeOptionalText(context?.ipAddress),
          occurredAt: new Date().toISOString(),
        })
        .catch(() => undefined);

      void this.issueCustomerSessionTrustChallenge({
        customerId: customer.id,
        actorId: customer.supabaseUserId,
        email: customer.email,
        sessionId,
        context,
        ignoreCooldown: true,
      }).catch(() => undefined);
    }

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
          lastName: user.lastName,
          mfa: this.buildCustomerMfaStatus(customer),
          sessionSecurity,
        },
      },
    };
  }
}
