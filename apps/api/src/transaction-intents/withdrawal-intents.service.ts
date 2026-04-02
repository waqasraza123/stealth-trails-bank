import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import { utils as ethersUtils } from "ethers";
import {
  AssetStatus,
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType,
  WalletStatus
} from "@prisma/client";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmWithdrawalIntentDto } from "./dto/confirm-withdrawal-intent.dto";
import { CreateWithdrawalIntentDto } from "./dto/create-withdrawal-intent.dto";
import { DecideWithdrawalIntentDto } from "./dto/decide-withdrawal-intent.dto";
import { FailWithdrawalIntentExecutionDto } from "./dto/fail-withdrawal-intent-execution.dto";
import { ListApprovedWithdrawalIntentsDto } from "./dto/list-approved-withdrawal-intents.dto";
import { ListBroadcastWithdrawalIntentsDto } from "./dto/list-broadcast-withdrawal-intents.dto";
import { ListPendingWithdrawalIntentsDto } from "./dto/list-pending-withdrawal-intents.dto";
import { ListQueuedWithdrawalIntentsDto } from "./dto/list-queued-withdrawal-intents.dto";
import { QueueApprovedWithdrawalIntentDto } from "./dto/queue-approved-withdrawal-intent.dto";
import { RecordWithdrawalBroadcastDto } from "./dto/record-withdrawal-broadcast.dto";
import { SettleConfirmedWithdrawalIntentDto } from "./dto/settle-confirmed-withdrawal-intent.dto";

type WithdrawalIntentContext = {
  customerId: string;
  customerAccountId: string;
  sourceWalletId: string;
  sourceWalletAddress: string;
  externalAddress: string;
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
    sourceWallet: {
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
    sourceWallet: {
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

type WithdrawalIntentReviewProjection = TransactionIntentProjection & {
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

type CreateWithdrawalIntentResult = {
  intent: TransactionIntentProjection;
  idempotencyReused: boolean;
};

type ListPendingWithdrawalIntentsResult = {
  intents: WithdrawalIntentReviewProjection[];
  limit: number;
};

type DecideWithdrawalIntentResult = {
  intent: WithdrawalIntentReviewProjection;
  decision: "approved" | "denied";
};

type ListApprovedWithdrawalIntentsResult = {
  intents: WithdrawalIntentReviewProjection[];
  limit: number;
};

type QueueApprovedWithdrawalIntentResult = {
  intent: WithdrawalIntentReviewProjection;
  queueReused: boolean;
};

type ListQueuedWithdrawalIntentsResult = {
  intents: WithdrawalIntentReviewProjection[];
  limit: number;
};

type RecordWithdrawalBroadcastResult = {
  intent: WithdrawalIntentReviewProjection;
  broadcastReused: boolean;
};

type FailWithdrawalIntentExecutionResult = {
  intent: WithdrawalIntentReviewProjection;
  failureReused: boolean;
};

type ListBroadcastWithdrawalIntentsResult = {
  intents: WithdrawalIntentReviewProjection[];
  limit: number;
};

type ConfirmWithdrawalIntentResult = {
  intent: WithdrawalIntentReviewProjection;
  confirmReused: boolean;
};

type SettleConfirmedWithdrawalIntentResult = {
  intent: WithdrawalIntentReviewProjection;
  settlementReused: boolean;
};

type WithdrawalTransitionActor = {
  actorType: "worker" | "operator";
  actorId: string;
  reconciliationReplay: boolean;
  replayReason: string | null;
};

@Injectable()
export class WithdrawalIntentsService {
  private readonly productChainId: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ledgerService: LedgerService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private normalizeAssetSymbol(assetSymbol: string): string {
    const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();

    if (!normalizedAssetSymbol) {
      throw new NotFoundException("Asset symbol is required.");
    }

    return normalizedAssetSymbol;
  }

  private normalizeBlockchainAddress(
    value: string,
    fieldName: string
  ): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    if (!ethersUtils.isAddress(normalizedValue)) {
      throw new BadRequestException(`${fieldName} must be a valid EVM address.`);
    }

    return ethersUtils.getAddress(normalizedValue);
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
      sourceWalletAddress: intent.sourceWallet?.address ?? null,
      destinationWalletId: intent.destinationWalletId,
      destinationWalletAddress: null,
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
  ): WithdrawalIntentReviewProjection {
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

  private async resolveWithdrawalIntentContext(
    supabaseUserId: string,
    assetSymbol: string,
    externalAddress: string
  ): Promise<WithdrawalIntentContext> {
    const normalizedExternalAddress = this.normalizeBlockchainAddress(
      externalAddress,
      "destinationAddress"
    );

    const customerAccount = await this.prismaService.customerAccount!.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true,
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

    const sourceWallet = customerAccount.wallets[0];
    const normalizedSourceWalletAddress = this.normalizeBlockchainAddress(
      sourceWallet.address,
      "sourceWalletAddress"
    );

    if (normalizedSourceWalletAddress === normalizedExternalAddress) {
      throw new BadRequestException(
        "Withdrawal destination address must differ from the product wallet address."
      );
    }

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
      sourceWalletId: sourceWallet.id,
      sourceWalletAddress: normalizedSourceWalletAddress,
      externalAddress: normalizedExternalAddress,
      assetId: asset.id,
      assetSymbol: asset.symbol,
      assetDisplayName: asset.displayName,
      assetDecimals: asset.decimals
    };
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
        sourceWallet: {
          select: {
            id: true,
            address: true
          }
        }
      }
    });
  }

  private async findWithdrawalIntentForReview(
    intentId: string
  ): Promise<InternalIntentRecord | null> {
    return this.prismaService.transactionIntent.findFirst({
      where: {
        id: intentId,
        intentType: TransactionIntentType.withdrawal,
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
        sourceWallet: {
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

  private assertReusableWithdrawalIntent(
    existingIntent: CustomerIntentRecord,
    context: WithdrawalIntentContext,
    requestedAmount: Prisma.Decimal
  ): void {
    const matches =
      existingIntent.customerAccountId === context.customerAccountId &&
      existingIntent.intentType === TransactionIntentType.withdrawal &&
      existingIntent.chainId === this.productChainId &&
      existingIntent.asset.symbol === context.assetSymbol &&
      existingIntent.sourceWalletId === context.sourceWalletId &&
      existingIntent.sourceWallet?.address === context.sourceWalletAddress &&
      existingIntent.externalAddress === context.externalAddress &&
      existingIntent.requestedAmount.equals(requestedAmount);

    if (!matches) {
      throw new ConflictException(
        "Idempotency key already exists for a different withdrawal request."
      );
    }
  }

  private ensureWithdrawalIntentIsPendingOperatorDecision(
    intent: InternalIntentRecord
  ): void {
    if (
      intent.status !== TransactionIntentStatus.requested ||
      intent.policyDecision !== PolicyDecision.pending
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not pending operator decision."
      );
    }
  }

  private ensureWithdrawalIntentIsApproved(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.approved ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not approved and ready for queueing."
      );
    }
  }

  private ensureWithdrawalIntentIsQueued(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.queued ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not queued for worker execution."
      );
    }
  }

  private ensureWithdrawalIntentIsBroadcast(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.broadcast ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not broadcast and ready for confirmation."
      );
    }
  }

  private ensureWithdrawalIntentIsConfirmed(intent: InternalIntentRecord): void {
    if (
      intent.status !== TransactionIntentStatus.confirmed ||
      intent.policyDecision !== PolicyDecision.approved
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not confirmed and ready for settlement."
      );
    }
  }

  private resolveWithdrawalBroadcastAddresses(
    intent: InternalIntentRecord,
    fromAddress: string | null,
    toAddress: string | null
  ): {
    normalizedFromAddress: string;
    normalizedToAddress: string;
  } {
    if (!intent.sourceWallet?.address) {
      throw new ConflictException(
        "Withdrawal transaction intent source wallet is missing."
      );
    }

    if (!intent.externalAddress) {
      throw new ConflictException(
        "Withdrawal transaction intent destination address is missing."
      );
    }

    const expectedFromAddress = this.normalizeBlockchainAddress(
      intent.sourceWallet.address,
      "sourceWalletAddress"
    );
    const expectedToAddress = this.normalizeBlockchainAddress(
      intent.externalAddress,
      "externalAddress"
    );

    const normalizedFromAddress = fromAddress
      ? this.normalizeBlockchainAddress(fromAddress, "fromAddress")
      : expectedFromAddress;

    const normalizedToAddress = toAddress
      ? this.normalizeBlockchainAddress(toAddress, "toAddress")
      : expectedToAddress;

    if (normalizedFromAddress !== expectedFromAddress) {
      throw new ConflictException(
        "Provided fromAddress does not match the withdrawal source wallet."
      );
    }

    if (normalizedToAddress !== expectedToAddress) {
      throw new ConflictException(
        "Provided toAddress does not match the withdrawal destination address."
      );
    }

    return {
      normalizedFromAddress,
      normalizedToAddress
    };
  }

  async createWithdrawalIntent(
    supabaseUserId: string,
    dto: CreateWithdrawalIntentDto
  ): Promise<CreateWithdrawalIntentResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const requestedAmount = this.parseRequestedAmount(dto.amount);
    const context = await this.resolveWithdrawalIntentContext(
      supabaseUserId,
      normalizedAssetSymbol,
      dto.destinationAddress
    );

    const existingIntent = await this.findIntentByIdempotencyKey(
      dto.idempotencyKey
    );

    if (existingIntent) {
      this.assertReusableWithdrawalIntent(
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
          const balanceTransition =
            await this.ledgerService.reserveWithdrawalBalance(transaction, {
              customerAccountId: context.customerAccountId,
              assetId: context.assetId,
              amount: requestedAmount
            });

          const intent = await transaction.transactionIntent.create({
            data: {
              customerAccountId: context.customerAccountId,
              assetId: context.assetId,
              sourceWalletId: context.sourceWalletId,
              destinationWalletId: null,
              externalAddress: context.externalAddress,
              chainId: this.productChainId,
              intentType: TransactionIntentType.withdrawal,
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
              sourceWallet: {
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
              action: "transaction_intent.withdrawal.requested",
              targetType: "TransactionIntent",
              targetId: intent.id,
              metadata: {
                customerAccountId: context.customerAccountId,
                assetId: context.assetId,
                assetSymbol: context.assetSymbol,
                assetDisplayName: context.assetDisplayName,
                requestedAmount: intent.requestedAmount.toString(),
                sourceWalletId: context.sourceWalletId,
                sourceWalletAddress: context.sourceWalletAddress,
                externalAddress: context.externalAddress,
                chainId: this.productChainId,
                idempotencyKey: dto.idempotencyKey,
                availableBalance: balanceTransition.availableBalance,
                pendingBalance: balanceTransition.pendingBalance
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

        this.assertReusableWithdrawalIntent(
          reusedIntent,
          context,
          requestedAmount
        );

        return {
          intent: this.mapIntentProjection(reusedIntent),
          idempotencyReused: true
        };
      }

      throw error;
    }
  }

  async listPendingWithdrawalIntents(
    query: ListPendingWithdrawalIntentsDto
  ): Promise<ListPendingWithdrawalIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.withdrawal,
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
        sourceWallet: {
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

  async decideWithdrawalIntent(
    intentId: string,
    operatorId: string,
    dto: DecideWithdrawalIntentDto
  ): Promise<DecideWithdrawalIntentResult> {
    if (dto.decision === "denied" && !dto.denialReason?.trim()) {
      throw new BadRequestException(
        "Denial reason is required for denied decisions."
      );
    }

    const existingIntent = await this.findWithdrawalIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    this.ensureWithdrawalIntentIsPendingOperatorDecision(existingIntent);

    const updatedIntent = await this.prismaService.$transaction(
      async (transaction) => {
        let availableBalance: string | null = null;
        let pendingBalance: string | null = null;

        const newStatus =
          dto.decision === "approved"
            ? TransactionIntentStatus.approved
            : TransactionIntentStatus.failed;
        const newPolicyDecision =
          dto.decision === "approved"
            ? PolicyDecision.approved
            : PolicyDecision.denied;

        if (dto.decision === "denied") {
          const balanceTransition =
            await this.ledgerService.releaseWithdrawalReservation(transaction, {
              customerAccountId: existingIntent.customerAccount!.id,
              assetId: existingIntent.asset.id,
              amount: existingIntent.requestedAmount
            });

          availableBalance = balanceTransition.availableBalance;
          pendingBalance = balanceTransition.pendingBalance;
        }

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
                ? "transaction_intent.withdrawal.approved"
                : "transaction_intent.withdrawal.denied",
            targetType: "TransactionIntent",
            targetId: existingIntent.id,
            metadata: {
              customerAccountId: existingIntent.customerAccount!.id,
              assetId: existingIntent.asset.id,
              assetSymbol: existingIntent.asset.symbol,
              assetDisplayName: existingIntent.asset.displayName,
              requestedAmount: existingIntent.requestedAmount.toString(),
              sourceWalletId: existingIntent.sourceWalletId,
              sourceWalletAddress: existingIntent.sourceWallet?.address ?? null,
              externalAddress: existingIntent.externalAddress,
              chainId: existingIntent.chainId,
              previousStatus: existingIntent.status,
              newStatus,
              previousPolicyDecision: existingIntent.policyDecision,
              newPolicyDecision,
              note: dto.note?.trim() ?? null,
              denialReason:
                dto.decision === "denied" ? dto.denialReason?.trim() ?? null : null,
              availableBalance,
              pendingBalance
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      decision: dto.decision
    };
  }

  async listApprovedWithdrawalIntents(
    query: ListApprovedWithdrawalIntentsDto
  ): Promise<ListApprovedWithdrawalIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.withdrawal,
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
        sourceWallet: {
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

  async queueApprovedWithdrawalIntent(
    intentId: string,
    operatorId: string,
    dto: QueueApprovedWithdrawalIntentDto
  ): Promise<QueueApprovedWithdrawalIntentResult> {
    const existingIntent = await this.findWithdrawalIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
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

    this.ensureWithdrawalIntentIsApproved(existingIntent);

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
            action: "transaction_intent.withdrawal.queued",
            targetType: "TransactionIntent",
            targetId: existingIntent.id,
            metadata: {
              customerAccountId: existingIntent.customerAccount!.id,
              assetId: existingIntent.asset.id,
              assetSymbol: existingIntent.asset.symbol,
              assetDisplayName: existingIntent.asset.displayName,
              requestedAmount: existingIntent.requestedAmount.toString(),
              sourceWalletId: existingIntent.sourceWalletId,
              sourceWalletAddress: existingIntent.sourceWallet?.address ?? null,
              externalAddress: existingIntent.externalAddress,
              chainId: existingIntent.chainId,
              previousStatus: existingIntent.status,
              newStatus: TransactionIntentStatus.queued,
              previousPolicyDecision: existingIntent.policyDecision,
              newPolicyDecision: existingIntent.policyDecision,
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      queueReused: false
    };
  }

  async listQueuedWithdrawalIntents(
    query: ListQueuedWithdrawalIntentsDto
  ): Promise<ListQueuedWithdrawalIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.withdrawal,
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
        sourceWallet: {
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

  async recordWithdrawalBroadcast(
    intentId: string,
    workerId: string,
    dto: RecordWithdrawalBroadcastDto
  ): Promise<RecordWithdrawalBroadcastResult> {
    const existingIntent = await this.findWithdrawalIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
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

    this.ensureWithdrawalIntentIsQueued(existingIntent);

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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
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

        this.ensureWithdrawalIntentIsQueued(currentIntent);

        if (
          currentLatestBlockchainTransaction?.txHash &&
          currentLatestBlockchainTransaction.txHash !== dto.txHash
        ) {
          throw new ConflictException(
            "A different blockchain transaction is already recorded for this withdrawal intent."
          );
        }

        const { normalizedFromAddress, normalizedToAddress } =
          this.resolveWithdrawalBroadcastAddresses(
            currentIntent,
            dto.fromAddress?.trim() ?? null,
            dto.toAddress?.trim() ?? null
          );

        if (currentLatestBlockchainTransaction) {
          await transaction.blockchainTransaction.update({
            where: {
              id: currentLatestBlockchainTransaction.id
            },
            data: {
              txHash: dto.txHash,
              status: BlockchainTransactionStatus.broadcast,
              fromAddress: normalizedFromAddress,
              toAddress: normalizedToAddress
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
              fromAddress: normalizedFromAddress,
              toAddress: normalizedToAddress,
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
            actorType: "worker",
            actorId: workerId,
            action: "transaction_intent.withdrawal.broadcast",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              sourceWalletId: currentIntent.sourceWalletId,
              sourceWalletAddress: normalizedFromAddress,
              externalAddress: currentIntent.externalAddress,
              chainId: currentIntent.chainId,
              txHash: dto.txHash,
              fromAddress: normalizedFromAddress,
              toAddress: normalizedToAddress,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.broadcast
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      broadcastReused: false
    };
  }

  async failWithdrawalIntentExecution(
    intentId: string,
    workerId: string,
    dto: FailWithdrawalIntentExecutionDto
  ): Promise<FailWithdrawalIntentExecutionResult> {
    const failureCode = dto.failureCode.trim();
    const failureReason = dto.failureReason.trim();

    const existingIntent = await this.findWithdrawalIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const latestBlockchainTransaction =
      existingIntent.blockchainTransactions[0] ?? null;

    

    if (
      existingIntent.policyDecision !== PolicyDecision.approved ||
      (existingIntent.status !== TransactionIntentStatus.queued &&
        existingIntent.status !== TransactionIntentStatus.broadcast)
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not in an execution state that can fail."
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
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
            "Withdrawal transaction intent is not in an execution state that can fail."
          );
        }

        if (
          dto.txHash &&
          currentLatestBlockchainTransaction?.txHash &&
          currentLatestBlockchainTransaction.txHash !== dto.txHash
        ) {
          throw new ConflictException(
            "A different blockchain transaction is already recorded for this withdrawal intent."
          );
        }

        const { normalizedFromAddress, normalizedToAddress } =
          this.resolveWithdrawalBroadcastAddresses(
            currentIntent,
            dto.fromAddress?.trim() ??
              currentLatestBlockchainTransaction?.fromAddress ??
              null,
            dto.toAddress?.trim() ??
              currentLatestBlockchainTransaction?.toAddress ??
              null
          );

        if (currentLatestBlockchainTransaction) {
          await transaction.blockchainTransaction.update({
            where: {
              id: currentLatestBlockchainTransaction.id
            },
            data: {
              txHash: dto.txHash ?? currentLatestBlockchainTransaction.txHash,
              status: BlockchainTransactionStatus.failed,
              fromAddress: normalizedFromAddress,
              toAddress: normalizedToAddress
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
              fromAddress: normalizedFromAddress,
              toAddress: normalizedToAddress,
              confirmedAt: null
            }
          });
        }

        const balanceTransition =
          await this.ledgerService.releaseWithdrawalReservation(transaction, {
            customerAccountId: currentIntent.customerAccount!.id,
            assetId: currentIntent.asset.id,
            amount: currentIntent.requestedAmount
          });

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
            actorType: "worker",
            actorId: workerId,
            action: "transaction_intent.withdrawal.execution_failed",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              sourceWalletId: currentIntent.sourceWalletId,
              sourceWalletAddress: normalizedFromAddress,
              externalAddress: currentIntent.externalAddress,
              chainId: currentIntent.chainId,
              txHash: dto.txHash ?? currentLatestBlockchainTransaction?.txHash ?? null,
              fromAddress: normalizedFromAddress,
              toAddress: normalizedToAddress,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.failed,
              failureCode,
              failureReason,
              availableBalance: balanceTransition.availableBalance,
              pendingBalance: balanceTransition.pendingBalance
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      failureReused: false
    };
  }

  async listBroadcastWithdrawalIntents(
    query: ListBroadcastWithdrawalIntentsDto
  ): Promise<ListBroadcastWithdrawalIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.withdrawal,
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
        sourceWallet: {
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

  async replayConfirmWithdrawalIntent(
    intentId: string,
    operatorId: string,
    note: string | null
  ): Promise<ConfirmWithdrawalIntentResult> {
    return this.confirmWithdrawalIntentWithActor(intentId, null, note, {
      actorType: "operator",
      actorId: operatorId,
      reconciliationReplay: true,
      replayReason: "withdrawal_settlement_reconciliation"
    });
  }

  async replaySettleConfirmedWithdrawalIntent(
    intentId: string,
    operatorId: string,
    note: string | null
  ): Promise<SettleConfirmedWithdrawalIntentResult> {
    return this.settleConfirmedWithdrawalIntentWithActor(intentId, note, {
      actorType: "operator",
      actorId: operatorId,
      reconciliationReplay: true,
      replayReason: "withdrawal_settlement_reconciliation"
    });
  }



  async confirmWithdrawalIntent(
    intentId: string,
    workerId: string,
    dto: ConfirmWithdrawalIntentDto
  ): Promise<ConfirmWithdrawalIntentResult> {
    return this.confirmWithdrawalIntentWithActor(
      intentId,
      dto.txHash?.trim() ?? null,
      null,
      {
        actorType: "worker",
        actorId: workerId,
        reconciliationReplay: false,
        replayReason: null
      }
    );
  }

  private async confirmWithdrawalIntentWithActor(
    intentId: string,
    txHash: string | null,
    note: string | null,
    actor: WithdrawalTransitionActor
  ): Promise<ConfirmWithdrawalIntentResult> {
    const existingIntent = await this.findWithdrawalIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const latestBlockchainTransaction =
      existingIntent.blockchainTransactions[0] ?? null;

    if (!latestBlockchainTransaction) {
      throw new ConflictException(
        "No blockchain transaction exists for this withdrawal intent."
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

    this.ensureWithdrawalIntentIsBroadcast(existingIntent);

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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
        }

        const currentLatestBlockchainTransaction =
          currentIntent.blockchainTransactions[0] ?? null;

        if (!currentLatestBlockchainTransaction) {
          throw new ConflictException(
            "No blockchain transaction exists for this withdrawal intent."
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

        this.ensureWithdrawalIntentIsBroadcast(currentIntent);

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
            action: "transaction_intent.withdrawal.confirmed",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              sourceWalletId: currentIntent.sourceWalletId,
              sourceWalletAddress: currentIntent.sourceWallet?.address ?? null,
              externalAddress: currentIntent.externalAddress,
              chainId: currentIntent.chainId,
              txHash: currentLatestBlockchainTransaction.txHash,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.confirmed,
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
        }

        return refreshedIntent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      confirmReused: false
    };
  }

  async settleConfirmedWithdrawalIntent(
    intentId: string,
    workerId: string,
    dto: SettleConfirmedWithdrawalIntentDto
  ): Promise<SettleConfirmedWithdrawalIntentResult> {
    return this.settleConfirmedWithdrawalIntentWithActor(
      intentId,
      dto.note?.trim() ?? null,
      {
        actorType: "worker",
        actorId: workerId,
        reconciliationReplay: false,
        replayReason: null
      }
    );
  }

  private async settleConfirmedWithdrawalIntentWithActor(
    intentId: string,
    note: string | null,
    actor: WithdrawalTransitionActor
  ): Promise<SettleConfirmedWithdrawalIntentResult> {
    const existingIntent = await this.findWithdrawalIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const existingLedgerJournal = await this.prismaService.ledgerJournal.findUnique({
      where: {
        transactionIntentId: intentId
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

    this.ensureWithdrawalIntentIsConfirmed(existingIntent);

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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
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

        this.ensureWithdrawalIntentIsConfirmed(currentIntent);

        const ledgerResult = await this.ledgerService.settleConfirmedWithdrawal(
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
            action: "transaction_intent.withdrawal.settled",
            targetType: "TransactionIntent",
            targetId: currentIntent.id,
            metadata: {
              customerAccountId: currentIntent.customerAccount!.id,
              assetId: currentIntent.asset.id,
              assetSymbol: currentIntent.asset.symbol,
              assetDisplayName: currentIntent.asset.displayName,
              requestedAmount: currentIntent.requestedAmount.toString(),
              settledAmount: currentIntent.requestedAmount.toString(),
              sourceWalletId: currentIntent.sourceWalletId,
              sourceWalletAddress: currentIntent.sourceWallet?.address ?? null,
              externalAddress: currentIntent.externalAddress,
              chainId: currentIntent.chainId,
              txHash: currentLatestBlockchainTransaction.txHash,
              previousStatus: currentIntent.status,
              newStatus: TransactionIntentStatus.settled,
              ledgerJournalId: ledgerResult.ledgerJournalId,
              debitLedgerAccountId: ledgerResult.debitLedgerAccountId,
              creditLedgerAccountId: ledgerResult.creditLedgerAccountId,
              availableBalance: ledgerResult.availableBalance,
              pendingBalance: ledgerResult.pendingBalance,
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
            sourceWallet: {
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
          throw new NotFoundException("Withdrawal transaction intent not found.");
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
