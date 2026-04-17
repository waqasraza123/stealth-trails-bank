import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  loadProductChainRuntimeConfig,
  loadSensitiveOperatorActionPolicyRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  AssetStatus,
  BlockchainTransactionStatus,
  LedgerJournalType,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType,
  WalletStatus
} from "@prisma/client";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmDepositIntentDto } from "./dto/confirm-deposit-intent.dto";
import { CreateDepositIntentDto } from "./dto/create-deposit-intent.dto";
import { DecideDepositIntentDto } from "./dto/decide-deposit-intent.dto";
import { FailDepositIntentExecutionDto } from "./dto/fail-deposit-intent-execution.dto";
import { ListApprovedDepositIntentsDto } from "./dto/list-approved-deposit-intents.dto";
import { ListBroadcastDepositIntentsDto } from "./dto/list-broadcast-deposit-intents.dto";
import { ListConfirmedDepositIntentsDto } from "./dto/list-confirmed-deposit-intents.dto";
import { ListQueuedDepositIntentsDto } from "./dto/list-queued-deposit-intents.dto";
import { ListMyTransactionIntentsDto } from "./dto/list-my-transaction-intents.dto";
import { ListPendingDepositIntentsDto } from "./dto/list-pending-deposit-intents.dto";
import { QueueApprovedDepositIntentDto } from "./dto/queue-approved-deposit-intent.dto";
import { RecordDepositBroadcastDto } from "./dto/record-deposit-broadcast.dto";
import { SettleConfirmedDepositIntentDto } from "./dto/settle-confirmed-deposit-intent.dto";

type DepositIntentContext = {
  customerId: string;
  customerAccountId: string;
  destinationWalletId: string;
  destinationWalletAddress: string;
  assetId: string;
  assetSymbol: string;
  assetDisplayName: string;
  assetDecimals: number;
};

type CustomerIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: {
    asset: {
      select: {
        id: true;
        symbol: true;
        displayName: true;
        decimals: true;
        chainId: true;
      };
    };
    destinationWallet: {
      select: {
        id: true;
        address: true;
      };
    };
  };
}>;

type InternalIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: {
    asset: {
      select: {
        id: true;
        symbol: true;
        displayName: true;
        decimals: true;
        chainId: true;
      };
    };
    destinationWallet: {
      select: {
        id: true;
        address: true;
      };
    };
    customerAccount: {
      select: {
        id: true;
        customerId: true;
        customer: {
          select: {
            id: true;
            supabaseUserId: true;
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    blockchainTransactions: {
      orderBy: {
        createdAt: "desc";
      };
      take: 1;
      select: {
        id: true;
        txHash: true;
        status: true;
        fromAddress: true;
        toAddress: true;
        createdAt: true;
        updatedAt: true;
        confirmedAt: true;
      };
    };
  };
}>;

type LatestBlockchainTransactionProjection = {
  id: string;
  txHash: string | null;
  status: BlockchainTransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

type TransactionIntentProjection = {
  id: string;
  customerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  sourceWalletId: string | null;
  sourceWalletAddress: string | null;
  destinationWalletId: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  chainId: number;
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type DepositIntentReviewProjection = TransactionIntentProjection & {
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  latestBlockchainTransaction: LatestBlockchainTransactionProjection | null;
};

type CreateDepositIntentResult = {
  intent: TransactionIntentProjection;
  idempotencyReused: boolean;
};

type ListMyTransactionIntentsResult = {
  intents: TransactionIntentProjection[];
  limit: number;
};

type ListPendingDepositIntentsResult = {
  intents: DepositIntentReviewProjection[];
  limit: number;
};

type DecideDepositIntentResult = {
  intent: DepositIntentReviewProjection;
  decision: "approved" | "denied";
};

type ListApprovedDepositIntentsResult = {
  intents: DepositIntentReviewProjection[];
  limit: number;
};

type QueueApprovedDepositIntentResult = {
  intent: DepositIntentReviewProjection;
  queueReused: boolean;
};

type ListQueuedDepositIntentsResult = {
  intents: DepositIntentReviewProjection[];
  limit: number;
};

type RecordDepositBroadcastResult = {
  intent: DepositIntentReviewProjection;
  broadcastReused: boolean;
};

type FailDepositIntentExecutionResult = {
  intent: DepositIntentReviewProjection;
  failureReused: boolean;
};

type ListBroadcastDepositIntentsResult = {
  intents: DepositIntentReviewProjection[];
  limit: number;
};

type ListConfirmedDepositIntentsResult = {
  intents: DepositIntentReviewProjection[];
  limit: number;
};

type ConfirmDepositIntentResult = {
  intent: DepositIntentReviewProjection;
  confirmReused: boolean;
};

type SettleConfirmedDepositIntentResult = {
  intent: DepositIntentReviewProjection;
  settlementReused: boolean;
};

type DepositTransitionActor = {
  actorType: "worker" | "operator";
  actorId: string;
  actorRole: string | null;
  reconciliationReplay: boolean;
  replayReason: string | null;
};

@Injectable()
export class TransactionIntentsService {
  private readonly productChainId: number;
  private readonly transactionIntentDecisionAllowedOperatorRoles: readonly string[];
  private readonly custodyOperationAllowedOperatorRoles: readonly string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ledgerService: LedgerService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    const sensitiveActionPolicyConfig =
      loadSensitiveOperatorActionPolicyRuntimeConfig();
    this.transactionIntentDecisionAllowedOperatorRoles = [
      ...sensitiveActionPolicyConfig.transactionIntentDecisionAllowedOperatorRoles
    ];
    this.custodyOperationAllowedOperatorRoles = [
      ...sensitiveActionPolicyConfig.custodyOperationAllowedOperatorRoles
    ];
  }

  private assertCanDecideTransactionIntent(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.transactionIntentDecisionAllowedOperatorRoles,
      "Operator role is not authorized to approve or deny transaction intents."
    );
  }

  private assertCanOperateCustody(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.custodyOperationAllowedOperatorRoles,
      "Operator role is not authorized to execute manual custody actions."
    );
  }

  private resolveExecutionChannel(
    actor: DepositTransitionActor
  ): "worker_runtime" | "manual_custody" | "reconciliation_replay" {
    if (actor.reconciliationReplay) {
      return "reconciliation_replay";
    }

    if (actor.actorType === "operator") {
      return "manual_custody";
    }

    return "worker_runtime";
  }

  private normalizeAssetSymbol(assetSymbol: string): string {
    const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();

    if (!normalizedAssetSymbol) {
      throw new NotFoundException("Asset symbol is required.");
    }

    return normalizedAssetSymbol;
  }

  private assertSensitiveIntentRequestAllowed(
    accountStatus: AccountLifecycleStatus
  ): void {
    if (accountStatus === AccountLifecycleStatus.restricted) {
      throw new ConflictException(
        "Customer account is currently under a risk hold and cannot create sensitive transaction requests."
      );
    }

    if (
      accountStatus === AccountLifecycleStatus.frozen ||
      accountStatus === AccountLifecycleStatus.closed
    ) {
      throw new ConflictException(
        "Customer account is not eligible for sensitive transaction requests in its current lifecycle state."
      );
    }
  }

  private parseRequestedAmount(amount: string): Prisma.Decimal {
    const requestedAmount = new Prisma.Decimal(amount);

    if (requestedAmount.lte(0)) {
      throw new BadRequestException(
        "Requested amount must be greater than zero."
      );
    }

    return requestedAmount;
  }

  private mapIntentProjection(
    intent: CustomerIntentRecord
  ): TransactionIntentProjection {
    return {
      id: intent.id,
      customerAccountId: intent.customerAccountId,
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId
      },
      sourceWalletId: intent.sourceWalletId,
      sourceWalletAddress: null,
      destinationWalletId: intent.destinationWalletId,
      destinationWalletAddress: intent.destinationWallet?.address ?? null,
      externalAddress: intent.externalAddress ?? null,
      chainId: intent.chainId,
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      idempotencyKey: intent.idempotencyKey,
      failureCode: intent.failureCode,
      failureReason: intent.failureReason,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString()
    };
  }

  private mapLatestBlockchainTransaction(
    intent: InternalIntentRecord
  ): LatestBlockchainTransactionProjection | null {
    const latestBlockchainTransaction = intent.blockchainTransactions[0];

    if (!latestBlockchainTransaction) {
      return null;
    }

    return {
      id: latestBlockchainTransaction.id,
      txHash: latestBlockchainTransaction.txHash,
      status: latestBlockchainTransaction.status,
      fromAddress: latestBlockchainTransaction.fromAddress,
      toAddress: latestBlockchainTransaction.toAddress,
      createdAt: latestBlockchainTransaction.createdAt.toISOString(),
      updatedAt: latestBlockchainTransaction.updatedAt.toISOString(),
      confirmedAt: latestBlockchainTransaction.confirmedAt?.toISOString() ?? null
    };
  }

  private mapIntentReviewProjection(
    intent: InternalIntentRecord
  ): DepositIntentReviewProjection {
    return {
      ...this.mapIntentProjection(intent),
      customer: {
        customerId: intent.customerAccount!.customer.id,
        customerAccountId: intent.customerAccount!.id,
        supabaseUserId: intent.customerAccount!.customer.supabaseUserId,
        email: intent.customerAccount!.customer.email,
        firstName: intent.customerAccount!.customer.firstName ?? "",
        lastName: intent.customerAccount!.customer.lastName ?? ""
      },
      latestBlockchainTransaction: this.mapLatestBlockchainTransaction(intent)
    };
  }

  private async resolveDepositIntentContext(
    supabaseUserId: string,
    assetSymbol: string
  ): Promise<DepositIntentContext> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true,
        status: true,
        customer: {
          select: {
            id: true
          }
        },
        wallets: {
          where: {
            chainId: this.productChainId,
            status: WalletStatus.active
          },
          orderBy: {
            createdAt: "asc"
          },
          take: 2,
          select: {
            id: true,
            address: true
          }
        }
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    this.assertSensitiveIntentRequestAllowed(customerAccount.status);

    if (customerAccount.wallets.length === 0) {
      throw new NotFoundException(
        "Active product-chain wallet projection not found."
      );
    }

    if (customerAccount.wallets.length > 1) {
      throw new ConflictException(
        "Multiple active product-chain wallets found for customer account."
      );
    }

    const destinationWallet = customerAccount.wallets[0];

    const asset = await this.prismaService.asset.findUnique({
      where: {
        chainId_symbol: {
          chainId: this.productChainId,
          symbol: assetSymbol
        }
      },
      select: {
        id: true,
        symbol: true,
        displayName: true,
        decimals: true,
        status: true
      }
    });

    if (!asset || asset.status !== AssetStatus.active) {
      throw new NotFoundException("Active asset not found for the product chain.");
    }

    return {
      customerId: customerAccount.customer.id,
      customerAccountId: customerAccount.id,
      destinationWalletId: destinationWallet.id,
      destinationWalletAddress: destinationWallet.address,
      assetId: asset.id,
      assetSymbol: asset.symbol,
      assetDisplayName: asset.displayName,
      assetDecimals: asset.decimals
    };
  }

  private async requireCustomerAccountId(
    supabaseUserId: string
  ): Promise<string> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return customerAccount.id;
  }

  private async findIntentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CustomerIntentRecord | null> {
    return this.prismaService.transactionIntent.findUnique({
      where: {
        idempotencyKey
      },
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        }
      }
    });
  }

  private async findDepositIntentForReview(
    intentId: string
  ): Promise<InternalIntentRecord | null> {
    return this.prismaService.transactionIntent.findFirst({
      where: {
        id: intentId,
        intentType: TransactionIntentType.deposit,
        chainId: this.productChainId
      },
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        blockchainTransactions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            txHash: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            createdAt: true,
            updatedAt: true,
            confirmedAt: true
          }
        }
      }
    });
  }

  private assertReusableDepositIntent(
    existingIntent: CustomerIntentRecord,
    context: DepositIntentContext,
    requestedAmount: Prisma.Decimal
  ): void {
    const matches =
      existingIntent.customerAccountId === context.customerAccountId &&
      existingIntent.intentType === TransactionIntentType.deposit &&
      existingIntent.chainId === this.productChainId &&
      existingIntent.asset.symbol === context.assetSymbol &&
      existingIntent.destinationWalletId === context.destinationWalletId &&
      existingIntent.destinationWallet?.address ===
        context.destinationWalletAddress &&
      existingIntent.requestedAmount.equals(requestedAmount);

    if (!matches) {
      throw new ConflictException(
        "Idempotency key already exists for a different transaction intent request."
      );
    }
  }

  private ensureDepositIntentIsPendingOperatorDecision(
    intent: InternalIntentRecord
  ): void {
    if (
      intent.status !== TransactionIntentStatus.requested ||
      intent.policyDecision !== PolicyDecision.pending
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not pending operator decision."
      );
    }
  }

  private ensureDepositIntentIsApproved(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.approved ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not approved and ready for queueing."
      );
    }
  }

  private ensureDepositIntentIsQueued(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.queued ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not queued for worker execution."
      );
    }
  }

  private ensureDepositIntentIsBroadcast(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.broadcast ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not broadcast and ready for confirmation."
      );
    }
  }

  private ensureDepositIntentIsConfirmed(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.confirmed ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not confirmed and ready for settlement."
      );
    }
  }

  async replayConfirmDepositIntent(
    intentId: string,
    operatorId: string,
    note: string | null
  ): Promise<ConfirmDepositIntentResult> {
    return this.confirmDepositIntentWithActor(
      intentId,
      null,
      note,
      {
        actorType: "operator",
        actorId: operatorId,
        actorRole: null,
        reconciliationReplay: true,
        replayReason: "deposit_settlement_reconciliation"
      }
    );
  }

  async replaySettleConfirmedDepositIntent(
    intentId: string,
    operatorId: string,
    note: string | null
  ): Promise<SettleConfirmedDepositIntentResult> {
    return this.settleConfirmedDepositIntentWithActor(
      intentId,
      note,
      {
        actorType: "operator",
        actorId: operatorId,
        actorRole: null,
        reconciliationReplay: true,
        replayReason: "deposit_settlement_reconciliation"
      }
    );
  }

  async createDepositIntent(
    supabaseUserId: string,
    dto: CreateDepositIntentDto
  ): Promise<CreateDepositIntentResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const requestedAmount = this.parseRequestedAmount(dto.amount);
    const context = await this.resolveDepositIntentContext(
      supabaseUserId,
      normalizedAssetSymbol
    );

    const existingIntent = await this.findIntentByIdempotencyKey(
      dto.idempotencyKey
    );

    if (existingIntent) {
      this.assertReusableDepositIntent(
        existingIntent,
        context,
        requestedAmount
      );

      return {
        intent: this.mapIntentProjection(existingIntent),
        idempotencyReused: true
      };
    }

    try {
      const createdIntent = await this.prismaService.$transaction(
        async (transaction) => {
          const intent = await transaction.transactionIntent.create({
            data: {
              customerAccountId: context.customerAccountId,
              assetId: context.assetId,
              sourceWalletId: null,
              destinationWalletId: context.destinationWalletId,
              chainId: this.productChainId,
              intentType: TransactionIntentType.deposit,
              status: TransactionIntentStatus.requested,
              policyDecision: PolicyDecision.pending,
              requestedAmount,
              settledAmount: null,
              idempotencyKey: dto.idempotencyKey,
              failureCode: null,
              failureReason: null
            },
            include: {
              asset: {
                select: {
                  id: true,
                  symbol: true,
                  displayName: true,
                  decimals: true,
                  chainId: true
                }
              },
              destinationWallet: {
                select: {
                  id: true,
                  address: true
                }
              }
            }
          });

          await transaction.auditEvent.create({
            data: {
              customerId: context.customerId,
              actorType: "customer",
              actorId: supabaseUserId,
              action: "transaction_intent.deposit.requested",
              targetType: "TransactionIntent",
              targetId: intent.id,
              metadata: {
                customerAccountId: context.customerAccountId,
                assetId: context.assetId,
                assetSymbol: context.assetSymbol,
                assetDisplayName: context.assetDisplayName,
                requestedAmount: intent.requestedAmount.toString(),
                destinationWalletId: context.destinationWalletId,
                destinationWalletAddress: context.destinationWalletAddress,
                chainId: this.productChainId,
                idempotencyKey: dto.idempotencyKey
              }
            }
          });

          return intent;
        }
      );

      return {
        intent: this.mapIntentProjection(createdIntent),
        idempotencyReused: false
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const reusedIntent = await this.findIntentByIdempotencyKey(
          dto.idempotencyKey
        );

        if (!reusedIntent) {
          throw error;
        }

        this.assertReusableDepositIntent(reusedIntent, context, requestedAmount);

        return {
          intent: this.mapIntentProjection(reusedIntent),
          idempotencyReused: true
        };
      }

      throw error;
    }
  }

  async listMyTransactionIntents(
    supabaseUserId: string,
    query: ListMyTransactionIntentsDto
  ): Promise<ListMyTransactionIntentsResult> {
    const limit = query.limit ?? 20;
    const customerAccountId = await this.requireCustomerAccountId(supabaseUserId);

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        customerAccountId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        }
      }
    });

    return {
      intents: intents.map((intent) => this.mapIntentProjection(intent)),
      limit
    };
  }

  async listPendingDepositIntents(
    query: ListPendingDepositIntentsDto
  ): Promise<ListPendingDepositIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.deposit,
        chainId: this.productChainId,
        status: TransactionIntentStatus.requested,
        policyDecision: PolicyDecision.pending
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        blockchainTransactions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            txHash: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            createdAt: true,
            updatedAt: true,
            confirmedAt: true
          }
        }
      }
    });

    return {
      intents: intents.map((intent) => this.mapIntentReviewProjection(intent)),
      limit
    };
  }

  async decideDepositIntent(
    intentId: string,
    operatorId: string,
    dto: DecideDepositIntentDto,
    operatorRole?: string
  ): Promise<DecideDepositIntentResult> {
    const normalizedOperatorRole =
      this.assertCanDecideTransactionIntent(operatorRole);

    if (dto.decision === "denied" && !dto.denialReason?.trim()) {
      throw new BadRequestException(
        "Denial reason is required for denied decisions."
      );
    }

    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    this.ensureDepositIntentIsPendingOperatorDecision(existingIntent);

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        const newStatus =
          dto.decision === "approved"
            ? TransactionIntentStatus.approved
            : TransactionIntentStatus.failed;
        const newPolicyDecision =
          dto.decision === "approved"
            ? PolicyDecision.approved
            : PolicyDecision.denied;

        await transaction.transactionIntent.update({
          where: {
            id: existingIntent.id
          },
          data: {
            status: newStatus,
            policyDecision: newPolicyDecision,
            failureCode: dto.decision === "denied" ? "policy_denied" : null,
            failureReason:
              dto.decision === "denied" ? dto.denialReason?.trim() ?? null : null
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: existingIntent.customerAccount!.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action:
              dto.decision === "approved"
                ? "transaction_intent.deposit.approved"
                : "transaction_intent.deposit.denied",
            targetType: "TransactionIntent",
            targetId: existingIntent.id,
            metadata: {
              customerAccountId: existingIntent.customerAccount!.id,
              assetId: existingIntent.asset.id,
              assetSymbol: existingIntent.asset.symbol,
              assetDisplayName: existingIntent.asset.displayName,
              requestedAmount: existingIntent.requestedAmount.toString(),
              destinationWalletId: existingIntent.destinationWalletId,
              destinationWalletAddress:
                existingIntent.destinationWallet?.address ?? null,
              chainId: existingIntent.chainId,
              previousStatus: existingIntent.status,
              newStatus,
              previousPolicyDecision: existingIntent.policyDecision,
              newPolicyDecision,
              operatorRole: normalizedOperatorRole,
              note: dto.note?.trim() ?? null,
              denialReason:
                dto.decision === "denied" ? dto.denialReason?.trim() ?? null : null
            }
          }
        });

        const refreshedIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: existingIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!refreshedIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      decision: dto.decision
    };
  }

  async listApprovedDepositIntents(
    query: ListApprovedDepositIntentsDto
  ): Promise<ListApprovedDepositIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.deposit,
        chainId: this.productChainId,
        status: TransactionIntentStatus.approved,
        policyDecision: PolicyDecision.approved
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        blockchainTransactions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            txHash: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            createdAt: true,
            updatedAt: true,
            confirmedAt: true
          }
        }
      }
    });

    return {
      intents: intents.map((intent) => this.mapIntentReviewProjection(intent)),
      limit
    };
  }

  async queueApprovedDepositIntent(
    intentId: string,
    operatorId: string,
    dto: QueueApprovedDepositIntentDto,
    operatorRole?: string
  ): Promise<QueueApprovedDepositIntentResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    if (
      existingIntent.status === TransactionIntentStatus.queued &&
      existingIntent.policyDecision === PolicyDecision.approved
    ) {
      return {
        intent: this.mapIntentReviewProjection(existingIntent),
        queueReused: true
      };
    }

    this.ensureDepositIntentIsApproved(existingIntent);

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        await transaction.transactionIntent.update({
          where: {
            id: existingIntent.id
          },
          data: {
            status: TransactionIntentStatus.queued,
            failureCode: null,
            failureReason: null
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: existingIntent.customerAccount!.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "transaction_intent.deposit.queued",
            targetType: "TransactionIntent",
            targetId: existingIntent.id,
            metadata: {
              customerAccountId: existingIntent.customerAccount!.id,
              assetId: existingIntent.asset.id,
              assetSymbol: existingIntent.asset.symbol,
              assetDisplayName: existingIntent.asset.displayName,
              requestedAmount: existingIntent.requestedAmount.toString(),
              destinationWalletId: existingIntent.destinationWalletId,
              destinationWalletAddress:
                existingIntent.destinationWallet?.address ?? null,
              chainId: existingIntent.chainId,
              previousStatus: existingIntent.status,
              newStatus: TransactionIntentStatus.queued,
              previousPolicyDecision: existingIntent.policyDecision,
              newPolicyDecision: existingIntent.policyDecision,
              operatorRole: normalizedOperatorRole,
              note: dto.note?.trim() ?? null
            }
          }
        });

        const refreshedIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: existingIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!refreshedIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      queueReused: false
    };
  }

  async listQueuedDepositIntents(
    query: ListQueuedDepositIntentsDto
  ): Promise<ListQueuedDepositIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.deposit,
        chainId: this.productChainId,
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        blockchainTransactions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            txHash: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            createdAt: true,
            updatedAt: true,
            confirmedAt: true
          }
        }
      }
    });

    return {
      intents: intents.map((intent) => this.mapIntentReviewProjection(intent)),
      limit
    };
  }

  async recordDepositBroadcast(
    intentId: string,
    workerId: string,
    dto: RecordDepositBroadcastDto
  ): Promise<RecordDepositBroadcastResult> {
    return this.recordDepositBroadcastWithActor(intentId, dto, {
      actorType: "worker",
      actorId: workerId,
      actorRole: null,
      reconciliationReplay: false,
      replayReason: null
    });
  }

  async recordDepositBroadcastByOperator(
    intentId: string,
    operatorId: string,
    dto: RecordDepositBroadcastDto,
    operatorRole?: string
  ): Promise<RecordDepositBroadcastResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);

    return this.recordDepositBroadcastWithActor(intentId, dto, {
      actorType: "operator",
      actorId: operatorId,
      actorRole: normalizedOperatorRole,
      reconciliationReplay: false,
      replayReason: null
    });
  }

  private async recordDepositBroadcastWithActor(
    intentId: string,
    dto: RecordDepositBroadcastDto,
    actor: DepositTransitionActor
  ): Promise<RecordDepositBroadcastResult> {
    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const latestBlockchainTransaction =
      existingIntent.blockchainTransactions[0] ?? null;

    if (
      existingIntent.status === TransactionIntentStatus.broadcast &&
      latestBlockchainTransaction?.txHash === dto.txHash &&
      latestBlockchainTransaction.status === BlockchainTransactionStatus.broadcast
    ) {
      return {
        intent: this.mapIntentReviewProjection(existingIntent),
        broadcastReused: true
      };
    }

    this.ensureDepositIntentIsQueued(existingIntent);

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        const currentIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: existingIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!currentIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        const currentLatestBlockchainTransaction =
          currentIntent.blockchainTransactions[0] ?? null;

        if (
          currentIntent.status === TransactionIntentStatus.broadcast &&
          currentLatestBlockchainTransaction?.txHash === dto.txHash &&
          currentLatestBlockchainTransaction.status ===
            BlockchainTransactionStatus.broadcast
        ) {
          return currentIntent;
        }

        this.ensureDepositIntentIsQueued(currentIntent);

        if (
          currentLatestBlockchainTransaction?.txHash &&
          currentLatestBlockchainTransaction.txHash !== dto.txHash
        ) {
          throw new ConflictException(
            "A different blockchain transaction is already recorded for this deposit intent."
          );
        }

        if (currentLatestBlockchainTransaction) {
          await transaction.blockchainTransaction.update({
            where: {
              id: currentLatestBlockchainTransaction.id
            },
            data: {
              txHash: dto.txHash,
              status: BlockchainTransactionStatus.broadcast,
              fromAddress: dto.fromAddress ?? null,
              toAddress: dto.toAddress ?? null
            }
          });
        } else {
          await transaction.blockchainTransaction.create({
            data: {
              transactionIntentId: currentIntent.id,
              chainId: currentIntent.chainId,
              txHash: dto.txHash,
              nonce: null,
              status: BlockchainTransactionStatus.broadcast,
              fromAddress: dto.fromAddress ?? null,
              toAddress: dto.toAddress ?? null,
              confirmedAt: null
            }
          });
        }

        await transaction.transactionIntent.update({
          where: {
            id: currentIntent.id
          },
          data: {
            status: TransactionIntentStatus.broadcast,
            failureCode: null,
            failureReason: null
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: currentIntent.customerAccount!.customer.id,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: "transaction_intent.deposit.broadcast",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              destinationWalletId: currentIntent.destinationWalletId,
              destinationWalletAddress:
                currentIntent.destinationWallet?.address ?? null,
              chainId: currentIntent.chainId,
              txHash: dto.txHash,
              fromAddress: dto.fromAddress ?? null,
              toAddress: dto.toAddress ?? null,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.broadcast,
              operatorRole: actor.actorRole,
              executionChannel: this.resolveExecutionChannel(actor),
              reconciliationReplay: actor.reconciliationReplay,
              replayReason: actor.replayReason
            }
          }
        });

        const refreshedIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: currentIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!refreshedIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      broadcastReused: false
    };
  }

  async failDepositIntentExecution(
    intentId: string,
    workerId: string,
    dto: FailDepositIntentExecutionDto
  ): Promise<FailDepositIntentExecutionResult> {
    return this.failDepositIntentExecutionWithActor(intentId, dto, {
      actorType: "worker",
      actorId: workerId,
      actorRole: null,
      reconciliationReplay: false,
      replayReason: null
    });
  }

  async failDepositIntentExecutionByOperator(
    intentId: string,
    operatorId: string,
    dto: FailDepositIntentExecutionDto,
    operatorRole?: string
  ): Promise<FailDepositIntentExecutionResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);

    return this.failDepositIntentExecutionWithActor(intentId, dto, {
      actorType: "operator",
      actorId: operatorId,
      actorRole: normalizedOperatorRole,
      reconciliationReplay: false,
      replayReason: null
    });
  }

  private async failDepositIntentExecutionWithActor(
    intentId: string,
    dto: FailDepositIntentExecutionDto,
    actor: DepositTransitionActor
  ): Promise<FailDepositIntentExecutionResult> {
    const failureCode = dto.failureCode.trim();
    const failureReason = dto.failureReason.trim();

    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const latestBlockchainTransaction =
      existingIntent.blockchainTransactions[0] ?? null;

    if (
      existingIntent.status === TransactionIntentStatus.failed &&
      existingIntent.policyDecision === PolicyDecision.approved &&
      existingIntent.failureCode === failureCode &&
      existingIntent.failureReason === failureReason &&
      (!dto.txHash || latestBlockchainTransaction?.txHash === dto.txHash)
    ) {
      return {
        intent: this.mapIntentReviewProjection(existingIntent),
        failureReused: true
      };
    }

    if (
      existingIntent.policyDecision !== PolicyDecision.approved ||
      (existingIntent.status !== TransactionIntentStatus.queued &&
        existingIntent.status !== TransactionIntentStatus.broadcast)
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not in an execution state that can fail."
      );
    }

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        const currentIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: existingIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!currentIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        const currentLatestBlockchainTransaction =
          currentIntent.blockchainTransactions[0] ?? null;

        if (
          currentIntent.status === TransactionIntentStatus.failed &&
          currentIntent.policyDecision === PolicyDecision.approved &&
          currentIntent.failureCode === failureCode &&
          currentIntent.failureReason === failureReason &&
          (!dto.txHash || currentLatestBlockchainTransaction?.txHash === dto.txHash)
        ) {
          return currentIntent;
        }

        if (
          currentIntent.policyDecision !== PolicyDecision.approved ||
          (currentIntent.status !== TransactionIntentStatus.queued &&
            currentIntent.status !== TransactionIntentStatus.broadcast)
        ) {
          throw new ConflictException(
            "Deposit transaction intent is not in an execution state that can fail."
          );
        }

        if (
          dto.txHash &&
          currentLatestBlockchainTransaction?.txHash &&
          currentLatestBlockchainTransaction.txHash !== dto.txHash
        ) {
          throw new ConflictException(
            "A different blockchain transaction is already recorded for this deposit intent."
          );
        }

        if (currentLatestBlockchainTransaction) {
          await transaction.blockchainTransaction.update({
            where: {
              id: currentLatestBlockchainTransaction.id
            },
            data: {
              txHash: dto.txHash ?? currentLatestBlockchainTransaction.txHash,
              status: BlockchainTransactionStatus.failed,
              fromAddress:
                dto.fromAddress ?? currentLatestBlockchainTransaction.fromAddress,
              toAddress: dto.toAddress ?? currentLatestBlockchainTransaction.toAddress
            }
          });
        } else {
          await transaction.blockchainTransaction.create({
            data: {
              transactionIntentId: currentIntent.id,
              chainId: currentIntent.chainId,
              txHash: dto.txHash ?? null,
              nonce: null,
              status: BlockchainTransactionStatus.failed,
              fromAddress: dto.fromAddress ?? null,
              toAddress: dto.toAddress ?? null,
              confirmedAt: null
            }
          });
        }

        await transaction.transactionIntent.update({
          where: {
            id: currentIntent.id
          },
          data: {
            status: TransactionIntentStatus.failed,
            failureCode,
            failureReason
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: currentIntent.customerAccount!.customer.id,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: "transaction_intent.deposit.execution_failed",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              destinationWalletId: currentIntent.destinationWalletId,
              destinationWalletAddress:
                currentIntent.destinationWallet?.address ?? null,
              chainId: currentIntent.chainId,
              txHash: dto.txHash ?? currentLatestBlockchainTransaction?.txHash ?? null,
              fromAddress:
                dto.fromAddress ?? currentLatestBlockchainTransaction?.fromAddress ?? null,
              toAddress:
                dto.toAddress ?? currentLatestBlockchainTransaction?.toAddress ?? null,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.failed,
              failureCode,
              failureReason,
              operatorRole: actor.actorRole,
              executionChannel: this.resolveExecutionChannel(actor),
              reconciliationReplay: actor.reconciliationReplay,
              replayReason: actor.replayReason
            }
          }
        });

        const refreshedIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: currentIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!refreshedIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      failureReused: false
    };
  }

  async listBroadcastDepositIntents(
    query: ListBroadcastDepositIntentsDto
  ): Promise<ListBroadcastDepositIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.deposit,
        chainId: this.productChainId,
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        blockchainTransactions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            txHash: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            createdAt: true,
            updatedAt: true,
            confirmedAt: true
          }
        }
      }
    });

    return {
      intents: intents.map((intent) => this.mapIntentReviewProjection(intent)),
      limit
    };
  }

  async listConfirmedDepositIntentsReadyToSettle(
    query: ListConfirmedDepositIntentsDto
  ): Promise<ListConfirmedDepositIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.deposit,
        chainId: this.productChainId,
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        ledgerJournals: {
          none: {
            journalType: LedgerJournalType.deposit_settlement
          }
        },
        blockchainTransactions: {
          some: {
            status: BlockchainTransactionStatus.confirmed
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        blockchainTransactions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            txHash: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            createdAt: true,
            updatedAt: true,
            confirmedAt: true
          }
        }
      }
    });

    return {
      intents: intents.map((intent) => this.mapIntentReviewProjection(intent)),
      limit
    };
  }

  async confirmDepositIntent(
    intentId: string,
    workerId: string,
    dto: ConfirmDepositIntentDto
  ): Promise<ConfirmDepositIntentResult> {
    return this.confirmDepositIntentWithActor(
      intentId,
      dto.txHash?.trim() ?? null,
      null,
      {
        actorType: "worker",
        actorId: workerId,
        actorRole: null,
        reconciliationReplay: false,
        replayReason: null
      }
    );
  }

  async confirmDepositIntentByOperator(
    intentId: string,
    operatorId: string,
    dto: ConfirmDepositIntentDto,
    operatorRole?: string
  ): Promise<ConfirmDepositIntentResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);

    return this.confirmDepositIntentWithActor(
      intentId,
      dto.txHash?.trim() ?? null,
      dto.note?.trim() ?? null,
      {
        actorType: "operator",
        actorId: operatorId,
        actorRole: normalizedOperatorRole,
        reconciliationReplay: false,
        replayReason: null
      }
    );
  }

  private async confirmDepositIntentWithActor(
    intentId: string,
    txHash: string | null,
    note: string | null,
    actor: DepositTransitionActor
  ): Promise<ConfirmDepositIntentResult> {
    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const latestBlockchainTransaction =
      existingIntent.blockchainTransactions[0] ?? null;

    if (!latestBlockchainTransaction) {
      throw new ConflictException(
        "No blockchain transaction exists for this deposit intent."
      );
    }

    if (txHash && latestBlockchainTransaction.txHash !== txHash) {
      throw new ConflictException(
        "Provided txHash does not match the latest blockchain transaction."
      );
    }

    if (
      existingIntent.status === TransactionIntentStatus.confirmed &&
      latestBlockchainTransaction.status === BlockchainTransactionStatus.confirmed
    ) {
      return {
        intent: this.mapIntentReviewProjection(existingIntent),
        confirmReused: true
      };
    }

    this.ensureDepositIntentIsBroadcast(existingIntent);

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        const currentIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: existingIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!currentIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        const currentLatestBlockchainTransaction =
          currentIntent.blockchainTransactions[0] ?? null;

        if (!currentLatestBlockchainTransaction) {
          throw new ConflictException(
            "No blockchain transaction exists for this deposit intent."
          );
        }

        if (txHash && currentLatestBlockchainTransaction.txHash !== txHash) {
          throw new ConflictException(
            "Provided txHash does not match the latest blockchain transaction."
          );
        }

        if (
          currentIntent.status === TransactionIntentStatus.confirmed &&
          currentLatestBlockchainTransaction.status ===
            BlockchainTransactionStatus.confirmed
        ) {
          return currentIntent;
        }

        this.ensureDepositIntentIsBroadcast(currentIntent);

        await transaction.blockchainTransaction.update({
          where: {
            id: currentLatestBlockchainTransaction.id
          },
          data: {
            status: BlockchainTransactionStatus.confirmed,
            confirmedAt: new Date()
          }
        });

        await transaction.transactionIntent.update({
          where: {
            id: currentIntent.id
          },
          data: {
            status: TransactionIntentStatus.confirmed
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: currentIntent.customerAccount!.customer.id,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: "transaction_intent.deposit.confirmed",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              destinationWalletId: currentIntent.destinationWalletId,
              destinationWalletAddress:
                currentIntent.destinationWallet?.address ?? null,
              chainId: currentIntent.chainId,
              txHash: currentLatestBlockchainTransaction.txHash,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.confirmed,
              operatorRole: actor.actorRole,
              executionChannel: this.resolveExecutionChannel(actor),
              note,
              reconciliationReplay: actor.reconciliationReplay,
              replayReason: actor.replayReason
            }
          }
        });

        const refreshedIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: currentIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!refreshedIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      confirmReused: false
    };
  }

  async settleConfirmedDepositIntent(
    intentId: string,
    workerId: string,
    dto: SettleConfirmedDepositIntentDto
  ): Promise<SettleConfirmedDepositIntentResult> {
    return this.settleConfirmedDepositIntentWithActor(
      intentId,
      dto.note?.trim() ?? null,
      {
        actorType: "worker",
        actorId: workerId,
        actorRole: null,
        reconciliationReplay: false,
        replayReason: null
      }
    );
  }

  async settleConfirmedDepositIntentByOperator(
    intentId: string,
    operatorId: string,
    dto: SettleConfirmedDepositIntentDto,
    operatorRole?: string
  ): Promise<SettleConfirmedDepositIntentResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);

    return this.settleConfirmedDepositIntentWithActor(
      intentId,
      dto.note?.trim() ?? null,
      {
        actorType: "operator",
        actorId: operatorId,
        actorRole: normalizedOperatorRole,
        reconciliationReplay: false,
        replayReason: null
      }
    );
  }

  private async settleConfirmedDepositIntentWithActor(
    intentId: string,
    note: string | null,
    actor: DepositTransitionActor
  ): Promise<SettleConfirmedDepositIntentResult> {
    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const existingLedgerJournal = await this.prismaService.ledgerJournal.findUnique({
      where: {
        transactionIntentId_journalType: {
          transactionIntentId: intentId,
          journalType: LedgerJournalType.deposit_settlement
        }
      },
      select: {
        id: true
      }
    });

    if (
      existingIntent.status === TransactionIntentStatus.settled &&
      existingLedgerJournal
    ) {
      return {
        intent: this.mapIntentReviewProjection(existingIntent),
        settlementReused: true
      };
    }

    const latestBlockchainTransaction =
      existingIntent.blockchainTransactions[0] ?? null;

    if (
      !latestBlockchainTransaction ||
      latestBlockchainTransaction.status !== BlockchainTransactionStatus.confirmed
    ) {
      throw new ConflictException(
        "Latest blockchain transaction is not confirmed."
      );
    }

    this.ensureDepositIntentIsConfirmed(existingIntent);

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        const currentIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: existingIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!currentIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        const currentLedgerJournal = await transaction.ledgerJournal.findUnique({
          where: {
            transactionIntentId_journalType: {
              transactionIntentId: currentIntent.id,
              journalType: LedgerJournalType.deposit_settlement
            }
          },
          select: {
            id: true
          }
        });

        if (
          currentIntent.status === TransactionIntentStatus.settled &&
          currentLedgerJournal
        ) {
          return currentIntent;
        }

        const currentLatestBlockchainTransaction =
          currentIntent.blockchainTransactions[0] ?? null;

        if (
          !currentLatestBlockchainTransaction ||
          currentLatestBlockchainTransaction.status !==
            BlockchainTransactionStatus.confirmed
        ) {
          throw new ConflictException(
            "Latest blockchain transaction is not confirmed."
          );
        }

        this.ensureDepositIntentIsConfirmed(currentIntent);

        const ledgerResult = await this.ledgerService.settleConfirmedDeposit(
          transaction,
          {
            transactionIntentId: currentIntent.id,
            customerAccountId: currentIntent.customerAccount!.id,
            assetId: currentIntent.asset.id,
            chainId: currentIntent.chainId,
            amount: currentIntent.requestedAmount
          }
        );

        await transaction.transactionIntent.update({
          where: {
            id: currentIntent.id
          },
          data: {
            status: TransactionIntentStatus.settled,
            settledAmount: currentIntent.requestedAmount
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: currentIntent.customerAccount!.customer.id,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: "transaction_intent.deposit.settled",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              settledAmount: currentIntent.requestedAmount.toString(),
              destinationWalletId: currentIntent.destinationWalletId,
              destinationWalletAddress:
                currentIntent.destinationWallet?.address ?? null,
              chainId: currentIntent.chainId,
              txHash: currentLatestBlockchainTransaction.txHash,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.settled,
              ledgerJournalId: ledgerResult.ledgerJournalId,
              debitLedgerAccountId: ledgerResult.debitLedgerAccountId,
              creditLedgerAccountId: ledgerResult.creditLedgerAccountId,
              availableBalance: ledgerResult.availableBalance,
              operatorRole: actor.actorRole,
              executionChannel: this.resolveExecutionChannel(actor),
              note,
              reconciliationReplay: actor.reconciliationReplay,
              replayReason: actor.replayReason
            }
          }
        });

        const refreshedIntent = await transaction.transactionIntent.findFirst({
          where: {
            id: currentIntent.id
          },
          include: {
            asset: {
              select: {
                id: true,
                symbol: true,
                displayName: true,
                decimals: true,
                chainId: true
              }
            },
            destinationWallet: {
              select: {
                id: true,
                address: true
              }
            },
            customerAccount: {
              select: {
                id: true,
                customerId: true,
                customer: {
                  select: {
                    id: true,
                    supabaseUserId: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            blockchainTransactions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              select: {
                id: true,
                txHash: true,
                status: true,
                fromAddress: true,
                toAddress: true,
                createdAt: true,
                updatedAt: true,
                confirmedAt: true
              }
            }
          }
        });

        if (!refreshedIntent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      settlementReused: false
    };
  }
}
