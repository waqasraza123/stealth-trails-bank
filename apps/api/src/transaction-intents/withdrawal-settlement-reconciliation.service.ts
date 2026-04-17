import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  BlockchainTransactionStatus,
  LedgerJournalType,
  Prisma,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OpenReconciliationReviewCaseDto } from "../review-cases/dto/open-reconciliation-review-case.dto";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { ListWithdrawalSettlementReconciliationDto } from "./dto/list-withdrawal-settlement-reconciliation.dto";
import { ReplayWithdrawalSettlementStepDto } from "./dto/replay-withdrawal-settlement-step.dto";
import { classifyWithdrawalSettlementReconciliation } from "./domain/withdrawal-settlement-reconciliation";
import type {
  WithdrawalSettlementReconciliationDecision,
  WithdrawalSettlementReconciliationState
} from "./domain/withdrawal-settlement-reconciliation";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

type WithdrawalSettlementReconciliationRecord = Prisma.TransactionIntentGetPayload<{
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
    ledgerJournals: {
      where: {
        journalType: "withdrawal_settlement";
      };
      take: 1;
      select: {
        id: true;
        journalType: true;
        postedAt: true;
        createdAt: true;
      };
    };
  };
}>;

type WithdrawalSettlementReconciliationItem = {
  intent: {
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
    externalAddress: string | null;
    chainId: number;
    status: TransactionIntentStatus;
    requestedAmount: string;
    settledAmount: string | null;
    createdAt: string;
    updatedAt: string;
    customer: {
      customerId: string;
      customerAccountId: string;
      supabaseUserId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    latestBlockchainTransaction: {
      id: string;
      txHash: string | null;
      status: BlockchainTransactionStatus;
      fromAddress: string | null;
      toAddress: string | null;
      createdAt: string;
      updatedAt: string;
      confirmedAt: string | null;
    } | null;
  };
  ledgerJournal: {
    id: string;
    journalType: string;
    postedAt: string;
    createdAt: string;
  } | null;
  reconciliation: WithdrawalSettlementReconciliationDecision;
};

type WithdrawalSettlementReconciliationSummary = Record<
  WithdrawalSettlementReconciliationState,
  number
>;

type ListWithdrawalSettlementReconciliationResult = {
  summary: WithdrawalSettlementReconciliationSummary;
  actionableCount: number;
  items: WithdrawalSettlementReconciliationItem[];
  limit: number;
};

@Injectable()
export class WithdrawalSettlementReconciliationService {
  private readonly productChainId: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly withdrawalIntentsService: WithdrawalIntentsService,
    private readonly reviewCasesService: ReviewCasesService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private createSummary(): WithdrawalSettlementReconciliationSummary {
    return {
      waiting_for_confirmation: 0,
      ready_for_confirm_replay: 0,
      ready_for_settle_replay: 0,
      healthy_settled: 0,
      manual_review_required: 0
    };
  }

  private mapItem(
    record: WithdrawalSettlementReconciliationRecord
  ): WithdrawalSettlementReconciliationItem {
    if (!record.customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    const latestBlockchainTransaction = record.blockchainTransactions[0] ?? null;
    const settlementLedgerJournal = record.ledgerJournals?.[0] ?? null;

    const reconciliation = classifyWithdrawalSettlementReconciliation({
      status: record.status,
      policyDecision: record.policyDecision,
      requestedAmount: record.requestedAmount.toString(),
      settledAmount: record.settledAmount?.toString() ?? null,
      latestBlockchainStatus: latestBlockchainTransaction?.status ?? null,
      hasLedgerJournal: Boolean(settlementLedgerJournal)
    });

    return {
      intent: {
        id: record.id,
        customerAccountId: record.customerAccountId,
        asset: {
          id: record.asset.id,
          symbol: record.asset.symbol,
          displayName: record.asset.displayName,
          decimals: record.asset.decimals,
          chainId: record.asset.chainId
        },
        sourceWalletId: record.sourceWalletId,
        sourceWalletAddress: record.sourceWallet?.address ?? null,
        externalAddress: record.externalAddress ?? null,
        chainId: record.chainId,
        status: record.status,
        requestedAmount: record.requestedAmount.toString(),
        settledAmount: record.settledAmount?.toString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        customer: {
          customerId: record.customerAccount.customer.id,
          customerAccountId: record.customerAccount.id,
          supabaseUserId: record.customerAccount.customer.supabaseUserId,
          email: record.customerAccount.customer.email,
          firstName: record.customerAccount.customer.firstName ?? "",
          lastName: record.customerAccount.customer.lastName ?? ""
        },
        latestBlockchainTransaction: latestBlockchainTransaction
          ? {
              id: latestBlockchainTransaction.id,
              txHash: latestBlockchainTransaction.txHash,
              status: latestBlockchainTransaction.status,
              fromAddress: latestBlockchainTransaction.fromAddress,
              toAddress: latestBlockchainTransaction.toAddress,
              createdAt: latestBlockchainTransaction.createdAt.toISOString(),
              updatedAt: latestBlockchainTransaction.updatedAt.toISOString(),
              confirmedAt:
                latestBlockchainTransaction.confirmedAt?.toISOString() ?? null
            }
          : null
      },
      ledgerJournal: settlementLedgerJournal
        ? {
            id: settlementLedgerJournal.id,
            journalType: settlementLedgerJournal.journalType,
            postedAt: settlementLedgerJournal.postedAt.toISOString(),
            createdAt: settlementLedgerJournal.createdAt.toISOString()
          }
        : null,
      reconciliation
    };
  }

  private async findRecordByIntentId(
    intentId: string
  ): Promise<WithdrawalSettlementReconciliationRecord | null> {
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
        },
        ledgerJournals: {
          where: {
            journalType: LedgerJournalType.withdrawal_settlement
          },
          take: 1,
          select: {
            id: true,
            journalType: true,
            postedAt: true,
            createdAt: true
          }
        }
      }
    });
  }

  async listWithdrawalSettlementReconciliation(
    query: ListWithdrawalSettlementReconciliationDto
  ): Promise<ListWithdrawalSettlementReconciliationResult> {
    const limit = query.limit ?? 20;

    const records = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.withdrawal,
        chainId: this.productChainId,
        status: {
          in: [
            TransactionIntentStatus.broadcast,
            TransactionIntentStatus.confirmed,
            TransactionIntentStatus.settled
          ]
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
        },
        ledgerJournals: {
          where: {
            journalType: LedgerJournalType.withdrawal_settlement
          },
          take: 1,
          select: {
            id: true,
            journalType: true,
            postedAt: true,
            createdAt: true
          }
        }
      }
    });

    const items = records.map((record) => this.mapItem(record));
    const filteredItems = query.state
      ? items.filter((item) => item.reconciliation.state === query.state)
      : items;

    const summary = this.createSummary();
    let actionableCount = 0;

    for (const item of filteredItems) {
      summary[item.reconciliation.state] += 1;

      if (item.reconciliation.actionable) {
        actionableCount += 1;
      }
    }

    return {
      summary,
      actionableCount,
      items: filteredItems,
      limit
    };
  }

  async replayConfirm(
    intentId: string,
    operatorId: string,
    dto: ReplayWithdrawalSettlementStepDto
  ) {
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const item = this.mapItem(record);

    if (item.reconciliation.replayAction !== "confirm") {
      throw new ConflictException(
        "Withdrawal transaction intent is not in a state that supports confirm replay."
      );
    }

    return this.withdrawalIntentsService.replayConfirmWithdrawalIntent(
      intentId,
      operatorId,
      dto.note?.trim() ?? null
    );
  }

  async replaySettle(
    intentId: string,
    operatorId: string,
    dto: ReplayWithdrawalSettlementStepDto
  ) {
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const item = this.mapItem(record);

    if (item.reconciliation.replayAction !== "settle") {
      throw new ConflictException(
        "Withdrawal transaction intent is not in a state that supports settle replay."
      );
    }

    return this.withdrawalIntentsService.replaySettleConfirmedWithdrawalIntent(
      intentId,
      operatorId,
      dto.note?.trim() ?? null
    );
  }

  async openManualReviewCase(
    intentId: string,
    operatorId: string,
    dto: OpenReconciliationReviewCaseDto
  ) {
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const item = this.mapItem(record);

    if (item.reconciliation.state !== "manual_review_required") {
      throw new ConflictException(
        "Withdrawal transaction intent is not in a manual-review-required reconciliation state."
      );
    }

    return this.reviewCasesService.openOrReuseReviewCase(this.prismaService, {
      customerId: item.intent.customer.customerId,
      customerAccountId: item.intent.customer.customerAccountId,
      transactionIntentId: item.intent.id,
      type: ReviewCaseType.reconciliation_review,
      reasonCode: item.reconciliation.reasonCode,
      notes: dto.note?.trim() ?? item.reconciliation.reason,
      actorType: "operator",
      actorId: operatorId,
      auditAction: "review_case.reconciliation_review.opened",
      auditMetadata: {
        intentType: "withdrawal",
        reconciliationState: item.reconciliation.state,
        reconciliationReason: item.reconciliation.reason,
        replayAction: item.reconciliation.replayAction,
        chainId: item.intent.chainId
      }
    });
  }
}
