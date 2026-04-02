import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  BlockchainTransactionStatus,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GetCustomerOperationsSnapshotDto } from "./dto/get-customer-operations-snapshot.dto";
import { ListMyTransactionHistoryDto } from "./dto/list-my-transaction-history.dto";
import { SearchTransactionOperationsDto } from "./dto/search-transaction-operations.dto";

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

type TransactionHistoryProjection = {
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
  policyDecision: string;
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  latestBlockchainTransaction: LatestBlockchainTransactionProjection | null;
};

type InternalTransactionOperationsProjection = TransactionHistoryProjection & {
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

type AuditTimelineProjection = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type ListMyTransactionHistoryResult = {
  customerAccountId: string;
  intents: TransactionHistoryProjection[];
  limit: number;
};

type SearchTransactionOperationsResult = {
  intents: InternalTransactionOperationsProjection[];
  limit: number;
};

type TransactionIntentAuditTimelineResult = {
  intentId: string;
  auditEvents: AuditTimelineProjection[];
};

type CustomerOperationsSnapshotResult = {
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  balances: {
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
    };
    availableBalance: string;
    pendingBalance: string;
    updatedAt: string;
  }[];
  recentIntents: TransactionHistoryProjection[];
  recentLimit: number;
};

type TransactionIntentRecord = Prisma.TransactionIntentGetPayload<{
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

@Injectable()
export class TransactionOperationsService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private normalizeOptionalAssetSymbol(value?: string): string | null {
    const normalizedValue = value?.trim().toUpperCase() ?? "";
    return normalizedValue ? normalizedValue : null;
  }

  private mapLatestBlockchainTransaction(
    intent: TransactionIntentRecord
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

  private mapTransactionHistoryProjection(
    intent: TransactionIntentRecord
  ): TransactionHistoryProjection {
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
      updatedAt: intent.updatedAt.toISOString(),
      latestBlockchainTransaction: this.mapLatestBlockchainTransaction(intent)
    };
  }

  private mapInternalTransactionOperationsProjection(
    intent: TransactionIntentRecord
  ): InternalTransactionOperationsProjection {
    if (!intent.customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return {
      ...this.mapTransactionHistoryProjection(intent),
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

  private buildIntentWhereInput(
    query: {
      intentType?: "deposit" | "withdrawal";
      status?:
        | "requested"
        | "review_required"
        | "approved"
        | "queued"
        | "broadcast"
        | "confirmed"
        | "settled"
        | "failed"
        | "cancelled"
        | "manually_resolved";
      assetSymbol?: string;
      customerAccountId?: string;
      supabaseUserId?: string;
      email?: string;
      txHash?: string;
      idempotencyKey?: string;
    }
  ): Prisma.TransactionIntentWhereInput {
    const normalizedAssetSymbol = this.normalizeOptionalAssetSymbol(
      query.assetSymbol
    );
    const conditions: Prisma.TransactionIntentWhereInput[] = [
      {
        chainId: this.productChainId
      }
    ];

    if (query.intentType) {
      conditions.push({
        intentType: query.intentType as TransactionIntentType
      });
    }

    if (query.status) {
      conditions.push({
        status: query.status as TransactionIntentStatus
      });
    }

    if (normalizedAssetSymbol) {
      conditions.push({
        asset: {
          symbol: normalizedAssetSymbol
        }
      });
    }

    if (query.customerAccountId?.trim()) {
      conditions.push({
        customerAccountId: query.customerAccountId.trim()
      });
    }

    if (query.supabaseUserId?.trim()) {
      conditions.push({
        customerAccount: {
          customer: {
            supabaseUserId: query.supabaseUserId.trim()
          }
        }
      });
    }

    if (query.email?.trim()) {
      conditions.push({
        customerAccount: {
          customer: {
            email: query.email.trim().toLowerCase()
          }
        }
      });
    }

    if (query.txHash?.trim()) {
      conditions.push({
        blockchainTransactions: {
          some: {
            txHash: query.txHash.trim()
          }
        }
      });
    }

    if (query.idempotencyKey?.trim()) {
      conditions.push({
        idempotencyKey: query.idempotencyKey.trim()
      });
    }

    return {
      AND: conditions
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

  async listMyTransactionHistory(
    supabaseUserId: string,
    query: ListMyTransactionHistoryDto
  ): Promise<ListMyTransactionHistoryResult> {
    const limit = query.limit ?? 20;
    const customerAccountId = await this.requireCustomerAccountId(supabaseUserId);

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        AND: [
          this.buildIntentWhereInput(query),
          {
            customerAccountId
          }
        ]
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
        sourceWallet: {
          select: {
            id: true,
            address: true
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
      customerAccountId,
      intents: intents.map((intent) => this.mapTransactionHistoryProjection(intent)),
      limit
    };
  }

  async searchTransactionOperations(
    query: SearchTransactionOperationsDto
  ): Promise<SearchTransactionOperationsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: this.buildIntentWhereInput(query),
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
        sourceWallet: {
          select: {
            id: true,
            address: true
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
      intents: intents.map((intent) =>
        this.mapInternalTransactionOperationsProjection(intent)
      ),
      limit
    };
  }

  async getTransactionIntentAuditTimeline(
    intentId: string
  ): Promise<TransactionIntentAuditTimelineResult> {
    const intent = await this.prismaService.transactionIntent.findFirst({
      where: {
        id: intentId,
        chainId: this.productChainId
      },
      select: {
        id: true
      }
    });

    if (!intent) {
      throw new NotFoundException("Transaction intent not found.");
    }

    const auditEvents = await this.prismaService.auditEvent.findMany({
      where: {
        targetType: "TransactionIntent",
        targetId: intentId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return {
      intentId,
      auditEvents: auditEvents.map((event) => ({
        id: event.id,
        actorType: event.actorType,
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString()
      }))
    };
  }

  async getCustomerOperationsSnapshot(
    query: GetCustomerOperationsSnapshotDto
  ): Promise<CustomerOperationsSnapshotResult> {
    const recentLimit = query.recentLimit ?? 20;

    if (!query.customerAccountId?.trim() && !query.supabaseUserId?.trim()) {
      throw new BadRequestException(
        "customerAccountId or supabaseUserId is required."
      );
    }

    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: query.customerAccountId?.trim()
        ? {
            id: query.customerAccountId.trim()
          }
        : {
            customer: {
              supabaseUserId: query.supabaseUserId!.trim()
            }
          },
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
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    const balances = await this.prismaService.customerAssetBalance.findMany({
      where: {
        customerAccountId: customerAccount.id
      },
      orderBy: {
        updatedAt: "desc"
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
        }
      }
    });

    const recentIntents = await this.prismaService.transactionIntent.findMany({
      where: {
        customerAccountId: customerAccount.id,
        chainId: this.productChainId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: recentLimit,
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
      customer: {
        customerId: customerAccount.customer.id,
        customerAccountId: customerAccount.id,
        supabaseUserId: customerAccount.customer.supabaseUserId,
        email: customerAccount.customer.email,
        firstName: customerAccount.customer.firstName ?? "",
        lastName: customerAccount.customer.lastName ?? ""
      },
      balances: balances.map((balance) => ({
        asset: {
          id: balance.asset.id,
          symbol: balance.asset.symbol,
          displayName: balance.asset.displayName,
          decimals: balance.asset.decimals,
          chainId: balance.asset.chainId
        },
        availableBalance: balance.availableBalance.toString(),
        pendingBalance: balance.pendingBalance.toString(),
        updatedAt: balance.updatedAt.toISOString()
      })),
      recentIntents: recentIntents.map((intent) =>
        this.mapTransactionHistoryProjection(intent)
      ),
      recentLimit
    };
  }
}
