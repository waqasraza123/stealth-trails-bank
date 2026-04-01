import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  AssetStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType,
  WalletStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepositIntentDto } from "./dto/create-deposit-intent.dto";
import { DecideDepositIntentDto } from "./dto/decide-deposit-intent.dto";
import { ListMyTransactionIntentsDto } from "./dto/list-my-transaction-intents.dto";
import { ListPendingDepositIntentsDto } from "./dto/list-pending-deposit-intents.dto";

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

type InternalReviewIntentRecord = Prisma.TransactionIntentGetPayload<{
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
  };
}>;

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
  destinationWalletId: string | null;
  destinationWalletAddress: string | null;
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

@Injectable()
export class TransactionIntentsService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private normalizeAssetSymbol(assetSymbol: string): string {
    const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();

    if (!normalizedAssetSymbol) {
      throw new BadRequestException("Asset symbol is required.");
    }

    return normalizedAssetSymbol;
  }

  private parseRequestedAmount(amount: string): Prisma.Decimal {
    let requestedAmount: Prisma.Decimal;

    try {
      requestedAmount = new Prisma.Decimal(amount);
    } catch {
      throw new BadRequestException(
        "Requested amount must be a valid decimal string."
      );
    }

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
      destinationWalletId: intent.destinationWalletId,
      destinationWalletAddress: intent.destinationWallet?.address ?? null,
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

  private mapIntentReviewProjection(
    intent: InternalReviewIntentRecord
  ): DepositIntentReviewProjection {
    return {
      ...this.mapIntentProjection(intent),
      customer: {
        customerId: intent.customerAccount.customer.id,
        customerAccountId: intent.customerAccount.id,
        supabaseUserId: intent.customerAccount.customer.supabaseUserId,
        email: intent.customerAccount.customer.email,
        firstName: intent.customerAccount.customer.firstName ?? "",
        lastName: intent.customerAccount.customer.lastName ?? ""
      }
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
        chainId: true,
        status: true
      }
    });

    if (!asset || asset.status !== AssetStatus.active) {
      throw new NotFoundException(
        "Active asset not found for the product chain."
      );
    }

    return {
      customerId: customerAccount.customer.id,
      customerAccountId: customerAccount.id,
      destinationWalletId: customerAccount.wallets[0].id,
      destinationWalletAddress: customerAccount.wallets[0].address,
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
    return this.prismaService.transactionIntent.findFirst({
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
  ): Promise<InternalReviewIntentRecord | null> {
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

          const metadata: Prisma.InputJsonObject = {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            assetDisplayName: context.assetDisplayName,
            requestedAmount: intent.requestedAmount.toString(),
            destinationWalletId: context.destinationWalletId,
            destinationWalletAddress: context.destinationWalletAddress,
            chainId: this.productChainId,
            idempotencyKey: dto.idempotencyKey
          };

          await transaction.auditEvent.create({
            data: {
              customerId: context.customerId,
              actorType: "customer",
              actorId: supabaseUserId,
              action: "transaction_intent.deposit.requested",
              targetType: "TransactionIntent",
              targetId: intent.id,
              metadata
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
    dto: DecideDepositIntentDto
  ): Promise<DecideDepositIntentResult> {
    const denialReason = dto.denialReason?.trim() ?? "";
    const note = dto.note?.trim() ?? null;

    if (dto.decision === "denied" && !denialReason) {
      throw new BadRequestException(
        "Denial reason is required for denied deposit requests."
      );
    }

    const existingIntent = await this.findDepositIntentForReview(intentId);

    if (!existingIntent) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    if (
      existingIntent.status !== TransactionIntentStatus.requested ||
      existingIntent.policyDecision !== PolicyDecision.pending
    ) {
      throw new ConflictException(
        "Deposit transaction intent is not pending operator decision."
      );
    }

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

        const updated = await transaction.transactionIntent.updateMany({
          where: {
            id: existingIntent.id,
            intentType: TransactionIntentType.deposit,
            chainId: this.productChainId,
            status: TransactionIntentStatus.requested,
            policyDecision: PolicyDecision.pending
          },
          data: {
            status: newStatus,
            policyDecision: newPolicyDecision,
            failureCode: dto.decision === "denied" ? "policy_denied" : null,
            failureReason: dto.decision === "denied" ? denialReason : null
          }
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            "Deposit transaction intent is not pending operator decision."
          );
        }

        const intent = await transaction.transactionIntent.findFirst({
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
            }
          }
        });

        if (!intent) {
          throw new NotFoundException("Deposit transaction intent not found.");
        }

        const metadata: Prisma.InputJsonObject = {
          customerAccountId: existingIntent.customerAccount.id,
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
          note,
          denialReason: dto.decision === "denied" ? denialReason : null
        };

        await transaction.auditEvent.create({
          data: {
            customerId: existingIntent.customerAccount.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action:
              dto.decision === "approved"
                ? "transaction_intent.deposit.approved"
                : "transaction_intent.deposit.denied",
            targetType: "TransactionIntent",
            targetId: existingIntent.id,
            metadata
          }
        });

        return intent;
      }
    );

    return {
      intent: this.mapIntentReviewProjection(updatedIntent),
      decision: dto.decision
    };
  }
}
