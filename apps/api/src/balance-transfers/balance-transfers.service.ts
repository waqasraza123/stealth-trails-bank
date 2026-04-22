import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  loadInternalBalanceTransferPolicyRuntimeConfig,
  loadProductChainRuntimeConfig,
  loadSensitiveOperatorActionPolicyRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  AssetStatus,
  PolicyDecision,
  Prisma,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType,
} from "@prisma/client";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { BalanceTransferEmailDeliveryService } from "./balance-transfer-email-delivery.service";
import { CreateBalanceTransferDto } from "./dto/create-balance-transfer.dto";
import { DecideBalanceTransferDto } from "./dto/decide-balance-transfer.dto";
import { ListPendingBalanceTransfersDto } from "./dto/list-pending-balance-transfers.dto";
import { PreviewBalanceTransferRecipientDto } from "./dto/preview-balance-transfer-recipient.dto";

const balanceTransferIntentInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true,
    },
  },
  customerAccount: {
    select: {
      id: true,
      status: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          supabaseUserId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  recipientCustomerAccount: {
    select: {
      id: true,
      status: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          supabaseUserId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  reviewCases: {
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      type: true,
      status: true,
      reasonCode: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.TransactionIntentInclude;

type BalanceTransferIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof balanceTransferIntentInclude;
}>;

type BalanceTransferIntentProjection = {
  id: string;
  customerAccountId: string | null;
  recipientCustomerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  recipientMaskedDisplay: string | null;
  recipientMaskedEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

type PendingBalanceTransferProjection = BalanceTransferIntentProjection & {
  sender: {
    customerId: string;
    customerAccountId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  recipient: {
    customerId: string | null;
    customerAccountId: string | null;
    maskedDisplay: string | null;
    maskedEmail: string | null;
  };
  reviewCase: {
    id: string;
    status: string;
    reasonCode: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type BalanceTransferThresholdOutcome = "settled_immediately" | "review_required";

type CreateBalanceTransferResult = {
  intent: BalanceTransferIntentProjection;
  idempotencyReused: boolean;
  thresholdOutcome: BalanceTransferThresholdOutcome;
};

type DecideBalanceTransferResult = {
  intent: BalanceTransferIntentProjection;
  decisionReused: boolean;
};

type PreviewRecipientResult = {
  normalizedEmail: string;
  available: boolean;
  maskedEmail: string | null;
  maskedDisplay: string | null;
  thresholdOutcome: BalanceTransferThresholdOutcome | null;
};

type PendingBalanceTransfersResult = {
  intents: PendingBalanceTransferProjection[];
  limit: number;
};

type ResolvedSenderContext = {
  customerId: string;
  customerAccountId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  assetId: string;
  assetSymbol: string;
  assetDisplayName: string;
  assetDecimals: number;
};

type ResolvedRecipientContext = {
  customerId: string;
  customerAccountId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  maskedEmail: string;
  maskedDisplay: string;
};

@Injectable()
export class BalanceTransfersService {
  private readonly productChainId: number;
  private readonly reviewThresholds =
    loadInternalBalanceTransferPolicyRuntimeConfig().reviewThresholds;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly emailDeliveryService: BalanceTransferEmailDeliveryService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private async appendAuditEvent(
    transaction: Prisma.TransactionClient,
    data: Prisma.AuditEventUncheckedCreateInput,
  ) {
    const auditEvent = await transaction.auditEvent.create({
      data,
    });
    await this.notificationsService.publishAuditEventRecord(
      auditEvent,
      transaction,
    );
    return auditEvent;
  }

  private normalizeAssetSymbol(value: string): string {
    const normalizedValue = value.trim().toUpperCase();
    if (!normalizedValue) {
      throw new BadRequestException("assetSymbol is required.");
    }
    return normalizedValue;
  }

  private normalizeEmail(value: string): string {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      throw new BadRequestException("recipientEmail is required.");
    }
    return normalizedValue;
  }

  private parseRequestedAmount(amount: string): Prisma.Decimal {
    const requestedAmount = new Prisma.Decimal(amount.trim());
    if (requestedAmount.lte(0)) {
      throw new BadRequestException("amount must be greater than zero.");
    }
    return requestedAmount;
  }

  private maskEmail(email: string): string {
    const [localPart, domainPart = ""] = email.trim().toLowerCase().split("@");
    const maskedLocal =
      localPart.length <= 2
        ? `${localPart.slice(0, 1)}*`
        : `${localPart.slice(0, 1)}${"*".repeat(Math.min(localPart.length - 2, 4))}${localPart.slice(-1)}`;
    const [domainName = "", ...domainTail] = domainPart.split(".");
    const maskedDomain = domainName
      ? `${domainName.slice(0, 1)}${"*".repeat(Math.max(Math.min(domainName.length - 1, 4), 1))}`
      : "";
    const domainSuffix = domainTail.length > 0 ? `.${domainTail.join(".")}` : "";
    return `${maskedLocal}@${maskedDomain}${domainSuffix}`;
  }

  private maskDisplayName(input: {
    firstName: string | null;
    lastName: string | null;
    fallbackEmail: string;
  }): string {
    const tokens = [input.firstName, input.lastName]
      .map((value) => value?.trim() ?? "")
      .filter(Boolean);

    if (tokens.length === 0) {
      const fallback = input.fallbackEmail.split("@")[0] ?? "Customer";
      return `${fallback.slice(0, 1).toUpperCase()}***`;
    }

    return tokens
      .map((token) => `${token.slice(0, 1).toUpperCase()}***`)
      .join(" ");
  }

  private mapIntentProjection(
    intent: BalanceTransferIntentRecord
  ): BalanceTransferIntentProjection {
    return {
      id: intent.id,
      customerAccountId: intent.customerAccountId,
      recipientCustomerAccountId: intent.recipientCustomerAccountId,
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId,
      },
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      idempotencyKey: intent.idempotencyKey,
      failureCode: intent.failureCode,
      failureReason: intent.failureReason,
      recipientMaskedDisplay: intent.recipientMaskedDisplay ?? null,
      recipientMaskedEmail: intent.recipientMaskedEmail ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }

  private mapPendingProjection(
    intent: BalanceTransferIntentRecord
  ): PendingBalanceTransferProjection {
    if (!intent.customerAccount) {
      throw new NotFoundException("Sender account projection not found.");
    }

    const reviewCase =
      intent.reviewCases.find(
        (item) => item.type === ReviewCaseType.internal_balance_transfer_review
      ) ?? null;

    return {
      ...this.mapIntentProjection(intent),
      sender: {
        customerId: intent.customerAccount.customer.id,
        customerAccountId: intent.customerAccount.id,
        email: intent.customerAccount.customer.email,
        firstName: intent.customerAccount.customer.firstName ?? "",
        lastName: intent.customerAccount.customer.lastName ?? "",
      },
      recipient: {
        customerId: intent.recipientCustomerAccount?.customer.id ?? null,
        customerAccountId: intent.recipientCustomerAccount?.id ?? null,
        maskedDisplay: intent.recipientMaskedDisplay ?? null,
        maskedEmail: intent.recipientMaskedEmail ?? null,
      },
      reviewCase: reviewCase
        ? {
            id: reviewCase.id,
            status: reviewCase.status,
            reasonCode: reviewCase.reasonCode,
            createdAt: reviewCase.createdAt.toISOString(),
            updatedAt: reviewCase.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private determineThresholdOutcome(
    assetSymbol: string,
    amount: Prisma.Decimal
  ): BalanceTransferThresholdOutcome {
    const threshold = this.reviewThresholds.find(
      (entry) => entry.assetSymbol === assetSymbol
    );

    if (!threshold) {
      return "review_required";
    }

    return amount.lte(new Prisma.Decimal(threshold.maxImmediateSettlementAmount))
      ? "settled_immediately"
      : "review_required";
  }

  private async resolveSenderContext(
    supabaseUserId: string,
    assetSymbol: string
  ): Promise<ResolvedSenderContext> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId,
        },
      },
      select: {
        id: true,
        status: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    if (customerAccount.status !== AccountLifecycleStatus.active) {
      throw new ConflictException(
        "Sender account must be active before internal transfers are allowed."
      );
    }

    const asset = await this.prismaService.asset.findUnique({
      where: {
        chainId_symbol: {
          chainId: this.productChainId,
          symbol: assetSymbol,
        },
      },
      select: {
        id: true,
        symbol: true,
        displayName: true,
        decimals: true,
        status: true,
      },
    });

    if (!asset || asset.status !== AssetStatus.active) {
      throw new NotFoundException("Active asset not found for the product chain.");
    }

    return {
      customerId: customerAccount.customer.id,
      customerAccountId: customerAccount.id,
      email: customerAccount.customer.email,
      firstName: customerAccount.customer.firstName,
      lastName: customerAccount.customer.lastName,
      assetId: asset.id,
      assetSymbol: asset.symbol,
      assetDisplayName: asset.displayName,
      assetDecimals: asset.decimals,
    };
  }

  private async findEligibleRecipientByEmail(
    normalizedEmail: string
  ): Promise<ResolvedRecipientContext | null> {
    const recipientAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        status: AccountLifecycleStatus.active,
        customer: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
      },
      select: {
        id: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!recipientAccount) {
      return null;
    }

    return {
      customerId: recipientAccount.customer.id,
      customerAccountId: recipientAccount.id,
      email: recipientAccount.customer.email,
      firstName: recipientAccount.customer.firstName,
      lastName: recipientAccount.customer.lastName,
      maskedEmail: this.maskEmail(recipientAccount.customer.email),
      maskedDisplay: this.maskDisplayName({
        firstName: recipientAccount.customer.firstName,
        lastName: recipientAccount.customer.lastName,
        fallbackEmail: recipientAccount.customer.email,
      }),
    };
  }

  private async findIntentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<BalanceTransferIntentRecord | null> {
    return this.prismaService.transactionIntent.findUnique({
      where: {
        idempotencyKey,
      },
      include: balanceTransferIntentInclude,
    });
  }

  private assertReusableIntent(
    existingIntent: BalanceTransferIntentRecord,
    sender: ResolvedSenderContext,
    recipient: ResolvedRecipientContext,
    requestedAmount: Prisma.Decimal
  ): void {
    if (
      existingIntent.intentType !== TransactionIntentType.internal_balance_transfer ||
      existingIntent.customerAccountId !== sender.customerAccountId ||
      existingIntent.recipientCustomerAccountId !== recipient.customerAccountId ||
      existingIntent.assetId !== sender.assetId ||
      !existingIntent.requestedAmount.equals(requestedAmount)
    ) {
      throw new ConflictException(
        "Provided idempotency key is already associated with a different internal balance transfer."
      );
    }
  }

  private async loadBalanceTransferIntent(
    intentId: string
  ): Promise<BalanceTransferIntentRecord | null> {
    return this.prismaService.transactionIntent.findFirst({
      where: {
        id: intentId,
        chainId: this.productChainId,
        intentType: TransactionIntentType.internal_balance_transfer,
      },
      include: balanceTransferIntentInclude,
    });
  }

  private assertCanDecideBalanceTransfer(operatorRole?: string): string {
    const runtimeConfig = loadSensitiveOperatorActionPolicyRuntimeConfig();

    return assertOperatorRoleAuthorized(
      operatorRole,
      runtimeConfig.transactionIntentDecisionAllowedOperatorRoles,
      "Operator role is not authorized to decide internal balance transfers."
    );
  }

  private async recordReviewCaseOpened(
    transaction: Prisma.TransactionClient,
    input: {
      sender: ResolvedSenderContext;
      recipient: ResolvedRecipientContext;
      intentId: string;
      assetSymbol: string;
      amount: Prisma.Decimal;
    }
  ): Promise<string> {
    const reviewCase = await transaction.reviewCase.create({
      data: {
        customerId: input.sender.customerId,
        customerAccountId: input.sender.customerAccountId,
        transactionIntentId: input.intentId,
        type: ReviewCaseType.internal_balance_transfer_review,
        status: ReviewCaseStatus.open,
        reasonCode: "transfer_threshold_review_required",
        notes: `Threshold review required before settling ${input.amount.toString()} ${input.assetSymbol}.`,
      },
    });

    await transaction.reviewCaseEvent.create({
      data: {
        reviewCaseId: reviewCase.id,
        actorType: "system",
        actorId: null,
        eventType: ReviewCaseEventType.opened,
        note: "Internal balance transfer queued for operator review.",
        metadata: {
          intentType: TransactionIntentType.internal_balance_transfer,
          assetSymbol: input.assetSymbol,
          amount: input.amount.toString(),
          recipientMaskedDisplay: input.recipient.maskedDisplay,
          recipientMaskedEmail: input.recipient.maskedEmail,
        },
      },
    });

    await this.appendAuditEvent(transaction, {
      customerId: input.sender.customerId,
      actorType: "system",
      actorId: null,
      action: "review_case.internal_balance_transfer_review.opened",
      targetType: "ReviewCase",
      targetId: reviewCase.id,
      metadata: {
        transactionIntentId: input.intentId,
        customerAccountId: input.sender.customerAccountId,
        assetSymbol: input.assetSymbol,
        amount: input.amount.toString(),
        recipientMaskedDisplay: input.recipient.maskedDisplay,
        recipientMaskedEmail: input.recipient.maskedEmail,
      },
    });

    return reviewCase.id;
  }

  private async resolveLinkedReviewCase(
    transaction: Prisma.TransactionClient,
    input: {
      intent: BalanceTransferIntentRecord;
      operatorId: string;
      note: string | null;
    }
  ): Promise<string | null> {
    const reviewCase =
      input.intent.reviewCases.find(
        (item) =>
          item.type === ReviewCaseType.internal_balance_transfer_review &&
          (item.status === ReviewCaseStatus.open ||
            item.status === ReviewCaseStatus.in_progress)
      ) ?? null;

    if (!reviewCase) {
      return null;
    }

    await transaction.reviewCase.update({
      where: {
        id: reviewCase.id,
      },
      data: {
        status: ReviewCaseStatus.resolved,
        resolvedAt: new Date(),
      },
    });

    await transaction.reviewCaseEvent.create({
      data: {
        reviewCaseId: reviewCase.id,
        actorType: "operator",
        actorId: input.operatorId,
        eventType: ReviewCaseEventType.resolved,
        note: input.note,
        metadata: {
          transactionIntentId: input.intent.id,
        },
      },
    });

    await this.appendAuditEvent(transaction, {
      customerId: input.intent.customerAccount?.customer.id ?? null,
      actorType: "operator",
      actorId: input.operatorId,
      action: "review_case.internal_balance_transfer_review.resolved",
      targetType: "ReviewCase",
      targetId: reviewCase.id,
      metadata: {
        transactionIntentId: input.intent.id,
        note: input.note,
      },
    });

    return reviewCase.id;
  }

  private dispatchCreatedNotifications(intent: BalanceTransferIntentRecord): void {
    if (!intent.customerAccount || !intent.recipientCustomerAccount) {
      return;
    }

    const senderMaskedDisplay =
      this.maskDisplayName({
        firstName: intent.customerAccount.customer.firstName,
        lastName: intent.customerAccount.customer.lastName,
        fallbackEmail: intent.customerAccount.customer.email,
      }) ?? null;
    const senderMaskedEmail = this.maskEmail(intent.customerAccount.customer.email);

    void Promise.allSettled([
      this.emailDeliveryService.sendTransferEmail({
        customerId: intent.customerAccount.customer.id,
        actorId: intent.customerAccount.customer.supabaseUserId,
        email: intent.customerAccount.customer.email,
        role: "sender",
        purpose: "created",
        transferId: intent.id,
        assetSymbol: intent.asset.symbol,
        amount: intent.requestedAmount.toString(),
        counterpartyMaskedDisplay: intent.recipientMaskedDisplay ?? null,
        counterpartyMaskedEmail: intent.recipientMaskedEmail ?? null,
        createdAt: intent.createdAt.toISOString(),
      }),
      this.emailDeliveryService.sendTransferEmail({
        customerId: intent.recipientCustomerAccount.customer.id,
        actorId: intent.recipientCustomerAccount.customer.supabaseUserId,
        email: intent.recipientCustomerAccount.customer.email,
        role: "recipient",
        purpose: "created",
        transferId: intent.id,
        assetSymbol: intent.asset.symbol,
        amount: intent.requestedAmount.toString(),
        counterpartyMaskedDisplay: senderMaskedDisplay,
        counterpartyMaskedEmail: senderMaskedEmail,
        createdAt: intent.createdAt.toISOString(),
      }),
    ]);
  }

  private dispatchStatusNotifications(
    intent: BalanceTransferIntentRecord,
    purpose: "review_required" | "settled" | "denied",
    note?: string | null
  ): void {
    if (!intent.customerAccount || !intent.recipientCustomerAccount) {
      return;
    }

    const senderMaskedDisplay = this.maskDisplayName({
      firstName: intent.customerAccount.customer.firstName,
      lastName: intent.customerAccount.customer.lastName,
      fallbackEmail: intent.customerAccount.customer.email,
    });
    const senderMaskedEmail = this.maskEmail(intent.customerAccount.customer.email);

    void Promise.allSettled([
      this.emailDeliveryService.sendTransferEmail({
        customerId: intent.customerAccount.customer.id,
        actorId: intent.customerAccount.customer.supabaseUserId,
        email: intent.customerAccount.customer.email,
        role: "sender",
        purpose,
        transferId: intent.id,
        assetSymbol: intent.asset.symbol,
        amount: intent.requestedAmount.toString(),
        counterpartyMaskedDisplay: intent.recipientMaskedDisplay ?? null,
        counterpartyMaskedEmail: intent.recipientMaskedEmail ?? null,
        createdAt: intent.createdAt.toISOString(),
        note,
      }),
      this.emailDeliveryService.sendTransferEmail({
        customerId: intent.recipientCustomerAccount.customer.id,
        actorId: intent.recipientCustomerAccount.customer.supabaseUserId,
        email: intent.recipientCustomerAccount.customer.email,
        role: "recipient",
        purpose,
        transferId: intent.id,
        assetSymbol: intent.asset.symbol,
        amount: intent.requestedAmount.toString(),
        counterpartyMaskedDisplay: senderMaskedDisplay,
        counterpartyMaskedEmail: senderMaskedEmail,
        createdAt: intent.createdAt.toISOString(),
        note,
      }),
    ]);
  }

  async previewRecipient(
    supabaseUserId: string,
    dto: PreviewBalanceTransferRecipientDto
  ): Promise<PreviewRecipientResult> {
    const senderAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId,
        },
      },
      select: {
        id: true,
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!senderAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    const normalizedEmail = this.normalizeEmail(dto.email);

    if (normalizedEmail === senderAccount.customer.email.trim().toLowerCase()) {
      throw new ConflictException(
        "Internal transfers to your own email address are not allowed."
      );
    }

    const recipient = await this.findEligibleRecipientByEmail(normalizedEmail);
    const thresholdOutcome =
      recipient && dto.assetSymbol?.trim() && dto.amount?.trim()
        ? this.determineThresholdOutcome(
            this.normalizeAssetSymbol(dto.assetSymbol),
            this.parseRequestedAmount(dto.amount)
          )
        : null;

    return {
      normalizedEmail,
      available: Boolean(recipient),
      maskedEmail: recipient?.maskedEmail ?? null,
      maskedDisplay: recipient?.maskedDisplay ?? null,
      thresholdOutcome,
    };
  }

  async createBalanceTransfer(
    supabaseUserId: string,
    dto: CreateBalanceTransferDto
  ): Promise<CreateBalanceTransferResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const normalizedRecipientEmail = this.normalizeEmail(dto.recipientEmail);
    const requestedAmount = this.parseRequestedAmount(dto.amount);
    const sender = await this.resolveSenderContext(
      supabaseUserId,
      normalizedAssetSymbol
    );

    if (normalizedRecipientEmail === sender.email.trim().toLowerCase()) {
      throw new ConflictException(
        "Internal transfers to your own email address are not allowed."
      );
    }

    const recipient =
      await this.findEligibleRecipientByEmail(normalizedRecipientEmail);

    if (!recipient) {
      throw new ConflictException(
        "Recipient is not available for internal balance transfers."
      );
    }

    if (recipient.customerAccountId === sender.customerAccountId) {
      throw new ConflictException(
        "Internal transfers to your own account are not allowed."
      );
    }

    const existingIntent = await this.findIntentByIdempotencyKey(dto.idempotencyKey);

    if (existingIntent) {
      this.assertReusableIntent(existingIntent, sender, recipient, requestedAmount);

      return {
        intent: this.mapIntentProjection(existingIntent),
        idempotencyReused: true,
        thresholdOutcome:
          existingIntent.status === TransactionIntentStatus.review_required
            ? "review_required"
            : "settled_immediately",
      };
    }

    const thresholdOutcome = this.determineThresholdOutcome(
      sender.assetSymbol,
      requestedAmount
    );

    try {
      const createdIntent = await this.prismaService.$transaction(async (transaction) => {
        const intent = await transaction.transactionIntent.create({
          data: {
            customerAccountId: sender.customerAccountId,
            recipientCustomerAccountId: recipient.customerAccountId,
            assetId: sender.assetId,
            sourceWalletId: null,
            destinationWalletId: null,
            externalAddress: null,
            recipientEmailSnapshot: normalizedRecipientEmail,
            recipientMaskedEmail: recipient.maskedEmail,
            recipientMaskedDisplay: recipient.maskedDisplay,
            chainId: this.productChainId,
            intentType: TransactionIntentType.internal_balance_transfer,
            status:
              thresholdOutcome === "review_required"
                ? TransactionIntentStatus.review_required
                : TransactionIntentStatus.settled,
            policyDecision:
              thresholdOutcome === "review_required"
                ? PolicyDecision.review_required
                : PolicyDecision.approved,
            requestedAmount,
            settledAmount:
              thresholdOutcome === "review_required" ? null : requestedAmount,
            idempotencyKey: dto.idempotencyKey,
            failureCode: null,
            failureReason: null,
          },
          include: balanceTransferIntentInclude,
        });

        if (thresholdOutcome === "review_required") {
          const balanceTransition =
            await this.ledgerService.reserveInternalBalanceTransferBalance(
              transaction,
              {
                transactionIntentId: intent.id,
                customerAccountId: sender.customerAccountId,
                assetId: sender.assetId,
                chainId: this.productChainId,
                amount: requestedAmount,
              }
            );

          const reviewCaseId = await this.recordReviewCaseOpened(transaction, {
            sender,
            recipient,
            intentId: intent.id,
            assetSymbol: sender.assetSymbol,
            amount: requestedAmount,
          });

          await this.appendAuditEvent(transaction, {
            customerId: sender.customerId,
            actorType: "customer",
            actorId: supabaseUserId,
            action: "transaction_intent.internal_balance_transfer.review_required",
            targetType: "TransactionIntent",
            targetId: intent.id,
            metadata: {
              customerAccountId: sender.customerAccountId,
              recipientCustomerAccountId: recipient.customerAccountId,
              assetId: sender.assetId,
              assetSymbol: sender.assetSymbol,
              requestedAmount: requestedAmount.toString(),
              reviewCaseId,
              recipientMaskedDisplay: recipient.maskedDisplay,
              recipientMaskedEmail: recipient.maskedEmail,
              ledgerJournalId: balanceTransition.ledgerJournalId,
              debitLedgerAccountId: balanceTransition.debitLedgerAccountId,
              creditLedgerAccountId: balanceTransition.creditLedgerAccountId,
              senderAvailableBalance: balanceTransition.senderAvailableBalance,
              senderPendingBalance: balanceTransition.senderPendingBalance,
            },
          });
        } else {
          const ledgerResult = await this.ledgerService.settleInternalBalanceTransfer(
            transaction,
            {
              transactionIntentId: intent.id,
              senderCustomerAccountId: sender.customerAccountId,
              recipientCustomerAccountId: recipient.customerAccountId,
              assetId: sender.assetId,
              chainId: this.productChainId,
              amount: requestedAmount,
              settleFromPending: false,
            }
          );

          await this.appendAuditEvent(transaction, {
            customerId: sender.customerId,
            actorType: "customer",
            actorId: supabaseUserId,
            action: "transaction_intent.internal_balance_transfer.settled",
            targetType: "TransactionIntent",
            targetId: intent.id,
            metadata: {
              customerAccountId: sender.customerAccountId,
              recipientCustomerAccountId: recipient.customerAccountId,
              assetId: sender.assetId,
              assetSymbol: sender.assetSymbol,
              requestedAmount: requestedAmount.toString(),
              settledAmount: requestedAmount.toString(),
              recipientMaskedDisplay: recipient.maskedDisplay,
              recipientMaskedEmail: recipient.maskedEmail,
              ledgerJournalId: ledgerResult.ledgerJournalId,
              debitLedgerAccountId: ledgerResult.debitLedgerAccountId,
              creditLedgerAccountId: ledgerResult.creditLedgerAccountId,
              senderAvailableBalance: ledgerResult.senderAvailableBalance,
              senderPendingBalance: ledgerResult.senderPendingBalance,
              recipientAvailableBalance: ledgerResult.recipientAvailableBalance,
              recipientPendingBalance: ledgerResult.recipientPendingBalance,
            },
          });
        }

        return transaction.transactionIntent.findFirstOrThrow({
          where: {
            id: intent.id,
          },
          include: balanceTransferIntentInclude,
        });
      });

      this.dispatchCreatedNotifications(createdIntent);
      this.dispatchStatusNotifications(
        createdIntent,
        thresholdOutcome === "review_required" ? "review_required" : "settled"
      );

      return {
        intent: this.mapIntentProjection(createdIntent),
        idempotencyReused: false,
        thresholdOutcome,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const reusedIntent = await this.findIntentByIdempotencyKey(dto.idempotencyKey);

        if (!reusedIntent) {
          throw error;
        }

        this.assertReusableIntent(reusedIntent, sender, recipient, requestedAmount);

        return {
          intent: this.mapIntentProjection(reusedIntent),
          idempotencyReused: true,
          thresholdOutcome:
            reusedIntent.status === TransactionIntentStatus.review_required
              ? "review_required"
              : "settled_immediately",
        };
      }

      throw error;
    }
  }

  async listPendingBalanceTransfers(
    query: ListPendingBalanceTransfersDto
  ): Promise<PendingBalanceTransfersResult> {
    const limit = query.limit ?? 20;
    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        intentType: TransactionIntentType.internal_balance_transfer,
        status: TransactionIntentStatus.review_required,
        policyDecision: PolicyDecision.review_required,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
      include: balanceTransferIntentInclude,
    });

    return {
      intents: intents.map((intent) => this.mapPendingProjection(intent)),
      limit,
    };
  }

  async decideBalanceTransfer(
    intentId: string,
    operatorId: string,
    dto: DecideBalanceTransferDto,
    operatorRole?: string
  ): Promise<DecideBalanceTransferResult> {
    const normalizedOperatorRole =
      this.assertCanDecideBalanceTransfer(operatorRole);

    if (dto.decision === "denied" && !dto.denialReason?.trim()) {
      throw new BadRequestException(
        "Denial reason is required for denied balance transfer decisions."
      );
    }

    const existingIntent = await this.loadBalanceTransferIntent(intentId);

    if (!existingIntent || !existingIntent.customerAccount || !existingIntent.recipientCustomerAccount) {
      throw new NotFoundException("Internal balance transfer not found.");
    }

    if (
      dto.decision === "approved" &&
      existingIntent.status === TransactionIntentStatus.settled &&
      existingIntent.policyDecision === PolicyDecision.approved
    ) {
      return {
        intent: this.mapIntentProjection(existingIntent),
        decisionReused: true,
      };
    }

    if (
      dto.decision === "denied" &&
      existingIntent.status === TransactionIntentStatus.cancelled &&
      existingIntent.policyDecision === PolicyDecision.denied
    ) {
      return {
        intent: this.mapIntentProjection(existingIntent),
        decisionReused: true,
      };
    }

    if (
      existingIntent.status !== TransactionIntentStatus.review_required ||
      existingIntent.policyDecision !== PolicyDecision.review_required
    ) {
      throw new ConflictException(
        "Internal balance transfer is not pending an operator decision."
      );
    }

    const senderAccount = existingIntent.customerAccount;
    const recipientAccount = existingIntent.recipientCustomerAccount;

    const updatedIntent = await this.prismaService.$transaction(async (transaction) => {
      if (dto.decision === "approved") {
        const ledgerResult = await this.ledgerService.settleInternalBalanceTransfer(
          transaction,
          {
            transactionIntentId: existingIntent.id,
            senderCustomerAccountId: senderAccount.id,
            recipientCustomerAccountId: recipientAccount.id,
            assetId: existingIntent.asset.id,
            chainId: existingIntent.chainId,
            amount: existingIntent.requestedAmount,
            settleFromPending: true,
          }
        );

        await transaction.transactionIntent.update({
          where: {
            id: existingIntent.id,
          },
          data: {
            status: TransactionIntentStatus.settled,
            policyDecision: PolicyDecision.approved,
            settledAmount: existingIntent.requestedAmount,
            failureCode: null,
            failureReason: null,
          },
        });

        const reviewCaseId = await this.resolveLinkedReviewCase(transaction, {
          intent: existingIntent,
          operatorId,
          note: dto.note?.trim() ?? null,
        });

        await this.appendAuditEvent(transaction, {
          customerId: senderAccount.customer.id,
          actorType: "operator",
          actorId: operatorId,
          action: "transaction_intent.internal_balance_transfer.approved",
          targetType: "TransactionIntent",
          targetId: existingIntent.id,
          metadata: {
            customerAccountId: senderAccount.id,
            recipientCustomerAccountId: recipientAccount.id,
            assetId: existingIntent.asset.id,
            assetSymbol: existingIntent.asset.symbol,
            requestedAmount: existingIntent.requestedAmount.toString(),
            settledAmount: existingIntent.requestedAmount.toString(),
            reviewCaseId,
            operatorRole: normalizedOperatorRole,
            note: dto.note?.trim() ?? null,
            ledgerJournalId: ledgerResult.ledgerJournalId,
            debitLedgerAccountId: ledgerResult.debitLedgerAccountId,
            creditLedgerAccountId: ledgerResult.creditLedgerAccountId,
            senderAvailableBalance: ledgerResult.senderAvailableBalance,
            senderPendingBalance: ledgerResult.senderPendingBalance,
            recipientAvailableBalance: ledgerResult.recipientAvailableBalance,
            recipientPendingBalance: ledgerResult.recipientPendingBalance,
          },
        });
      } else {
        const ledgerResult =
          await this.ledgerService.releaseInternalBalanceTransferReservation(
            transaction,
            {
              transactionIntentId: existingIntent.id,
              customerAccountId: senderAccount.id,
              assetId: existingIntent.asset.id,
              chainId: existingIntent.chainId,
              amount: existingIntent.requestedAmount,
            }
          );

        await transaction.transactionIntent.update({
          where: {
            id: existingIntent.id,
          },
          data: {
            status: TransactionIntentStatus.cancelled,
            policyDecision: PolicyDecision.denied,
            settledAmount: null,
            failureCode: "policy_denied",
            failureReason: dto.denialReason?.trim() ?? null,
          },
        });

        const reviewCaseId = await this.resolveLinkedReviewCase(transaction, {
          intent: existingIntent,
          operatorId,
          note: dto.note?.trim() ?? dto.denialReason?.trim() ?? null,
        });

        await this.appendAuditEvent(transaction, {
          customerId: senderAccount.customer.id,
          actorType: "operator",
          actorId: operatorId,
          action: "transaction_intent.internal_balance_transfer.denied",
          targetType: "TransactionIntent",
          targetId: existingIntent.id,
          metadata: {
            customerAccountId: senderAccount.id,
            recipientCustomerAccountId: recipientAccount.id,
            assetId: existingIntent.asset.id,
            assetSymbol: existingIntent.asset.symbol,
            requestedAmount: existingIntent.requestedAmount.toString(),
            reviewCaseId,
            operatorRole: normalizedOperatorRole,
            note: dto.note?.trim() ?? null,
            denialReason: dto.denialReason?.trim() ?? null,
            ledgerJournalId: ledgerResult.ledgerJournalId,
            debitLedgerAccountId: ledgerResult.debitLedgerAccountId,
            creditLedgerAccountId: ledgerResult.creditLedgerAccountId,
            senderAvailableBalance: ledgerResult.senderAvailableBalance,
            senderPendingBalance: ledgerResult.senderPendingBalance,
          },
        });
      }

      return transaction.transactionIntent.findFirstOrThrow({
        where: {
          id: existingIntent.id,
        },
        include: balanceTransferIntentInclude,
      });
    });

    this.dispatchStatusNotifications(
      updatedIntent,
      dto.decision === "approved" ? "settled" : "denied",
      dto.decision === "denied" ? dto.denialReason?.trim() ?? null : dto.note?.trim() ?? null
    );

    return {
      intent: this.mapIntentProjection(updatedIntent),
      decisionReused: false,
    };
  }
}
