import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  loadProductChainRuntimeConfig,
  loadSensitiveOperatorActionPolicyRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  BlockchainTransactionStatus,
  DepositSettlementReplayAction,
  DepositSettlementReplayApprovalRequestStatus,
  LedgerJournalType,
  Prisma,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import { OpenReconciliationReviewCaseDto } from "../review-cases/dto/open-reconciliation-review-case.dto";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { classifyDepositSettlementReconciliation } from "./domain/deposit-settlement-reconciliation";
import type {
  DepositSettlementReconciliationDecision,
  DepositSettlementReconciliationState
} from "./domain/deposit-settlement-reconciliation";
import { ListDepositSettlementReconciliationDto } from "./dto/list-deposit-settlement-reconciliation.dto";
import { ReplayDepositSettlementStepDto } from "./dto/replay-deposit-settlement-step.dto";
import { RequestDepositSettlementReplayApprovalDto } from "./dto/request-deposit-settlement-replay-approval.dto";
import { TransactionIntentsService } from "./transaction-intents.service";

type DepositSettlementReconciliationRecord = Prisma.TransactionIntentGetPayload<{
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
    ledgerJournals: {
      where: {
        journalType: "deposit_settlement";
      };
      take: 1;
      select: {
        id: true;
        journalType: true;
        postedAt: true;
        createdAt: true;
      };
    };
    depositSettlementProof: {
      select: {
        id: true;
        ledgerJournalId: true;
        blockchainTransactionId: true;
        txHash: true;
        fromAddress: true;
        toAddress: true;
        settledAmount: true;
        confirmedAt: true;
        createdAt: true;
      };
    };
  };
}>;

type DepositSettlementReconciliationItem = {
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
    destinationWalletId: string | null;
    destinationWalletAddress: string | null;
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
  settlementProof: {
    id: string;
    ledgerJournalId: string;
    blockchainTransactionId: string;
    txHash: string;
    fromAddress: string;
    toAddress: string;
    settledAmount: string;
    confirmedAt: string;
    createdAt: string;
  } | null;
  reconciliation: DepositSettlementReconciliationDecision;
};

type DepositSettlementReconciliationSummary = Record<
  DepositSettlementReconciliationState,
  number
>;

type ListDepositSettlementReconciliationResult = {
  summary: DepositSettlementReconciliationSummary;
  actionableCount: number;
  items: DepositSettlementReconciliationItem[];
  limit: number;
};

type DepositSettlementReplayApprovalRequestRecord =
  Prisma.DepositSettlementReplayApprovalRequestGetPayload<{
    include: {
      transactionIntent: {
        select: {
          id: true;
          chainId: true;
        };
      };
    };
  }>;

type DepositSettlementReplayApprovalRequestProjection = {
  id: string;
  transactionIntentId: string;
  chainId: number;
  replayAction: DepositSettlementReplayAction;
  status: DepositSettlementReplayApprovalRequestStatus;
  requestedByOperatorId: string;
  requestedByOperatorRole: string;
  requestNote: string | null;
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
  executedAt: string | null;
};

type DepositSettlementReplayApprovalRequestMutationResult = {
  request: DepositSettlementReplayApprovalRequestProjection;
  stateReused: boolean;
};

type ListDepositSettlementReplayApprovalRequestsResult = {
  requests: DepositSettlementReplayApprovalQueueItem[];
  limit: number;
  totalCount: number;
  summary: {
    byStatus: Array<{
      status: DepositSettlementReplayApprovalRequestStatus;
      count: number;
    }>;
  };
};

type DepositSettlementReplayApprovalQueueItem = {
  request: DepositSettlementReplayApprovalRequestProjection;
  intent: {
    id: string;
    customerAccountId: string | null;
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
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
    };
  };
};

type DepositSettlementReplayApprovalQueueRecord =
  Prisma.DepositSettlementReplayApprovalRequestGetPayload<{
    include: {
      transactionIntent: {
        select: {
          id: true;
          customerAccountId: true;
          chainId: true;
          status: true;
          requestedAmount: true;
          settledAmount: true;
          createdAt: true;
          updatedAt: true;
          asset: {
            select: {
              id: true;
              symbol: true;
              displayName: true;
              decimals: true;
              chainId: true;
            };
          };
          customerAccount: {
            select: {
              id: true;
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
      };
    };
  }>;

@Injectable()
export class DepositSettlementReconciliationService {
  private readonly productChainId: number;
  private readonly custodyOperationAllowedOperatorRoles: readonly string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly transactionIntentsService: TransactionIntentsService,
    private readonly reviewCasesService: ReviewCasesService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    this.custodyOperationAllowedOperatorRoles = [
      ...loadSensitiveOperatorActionPolicyRuntimeConfig()
        .custodyOperationAllowedOperatorRoles
    ];
  }

  private assertCanOperateCustody(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.custodyOperationAllowedOperatorRoles,
      "Operator role is not authorized to execute governed deposit replay actions."
    );
  }

  private createSummary(): DepositSettlementReconciliationSummary {
    return {
      waiting_for_confirmation: 0,
      ready_for_confirm_replay: 0,
      ready_for_settle_replay: 0,
      healthy_settled: 0,
      manual_review_required: 0
    };
  }

  private mapReplayApprovalRequest(
    request: DepositSettlementReplayApprovalRequestRecord
  ): DepositSettlementReplayApprovalRequestProjection {
    return {
      id: request.id,
      transactionIntentId: request.transactionIntentId,
      chainId: request.chainId,
      replayAction: request.replayAction,
      status: request.status,
      requestedByOperatorId: request.requestedByOperatorId,
      requestedByOperatorRole: request.requestedByOperatorRole,
      requestNote: request.requestNote ?? null,
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
      executedAt: request.executedAt?.toISOString() ?? null
    };
  }

  private mapReplayApprovalQueueItem(
    request: DepositSettlementReplayApprovalQueueRecord
  ): DepositSettlementReplayApprovalQueueItem {
    if (!request.transactionIntent.customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return {
      request: this.mapReplayApprovalRequest(request),
      intent: {
        id: request.transactionIntent.id,
        customerAccountId: request.transactionIntent.customerAccountId,
        chainId: request.transactionIntent.chainId,
        status: request.transactionIntent.status,
        requestedAmount: request.transactionIntent.requestedAmount.toString(),
        settledAmount:
          request.transactionIntent.settledAmount?.toString() ?? null,
        createdAt: request.transactionIntent.createdAt.toISOString(),
        updatedAt: request.transactionIntent.updatedAt.toISOString(),
        customer: {
          customerId: request.transactionIntent.customerAccount.customer.id,
          customerAccountId: request.transactionIntent.customerAccount.id,
          supabaseUserId:
            request.transactionIntent.customerAccount.customer.supabaseUserId,
          email: request.transactionIntent.customerAccount.customer.email,
          firstName:
            request.transactionIntent.customerAccount.customer.firstName ?? "",
          lastName:
            request.transactionIntent.customerAccount.customer.lastName ?? ""
        },
        asset: {
          id: request.transactionIntent.asset.id,
          symbol: request.transactionIntent.asset.symbol,
          displayName: request.transactionIntent.asset.displayName,
          decimals: request.transactionIntent.asset.decimals,
          chainId: request.transactionIntent.asset.chainId
        }
      }
    };
  }

  private mapItem(
    record: DepositSettlementReconciliationRecord
  ): DepositSettlementReconciliationItem {
    if (!record.customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    const latestBlockchainTransaction = record.blockchainTransactions[0] ?? null;
    const settlementLedgerJournal = record.ledgerJournals?.[0] ?? null;
    const settlementProof = record.depositSettlementProof ?? null;

    const reconciliation = classifyDepositSettlementReconciliation({
      status: record.status,
      policyDecision: record.policyDecision,
      requestedAmount: record.requestedAmount.toString(),
      settledAmount: record.settledAmount?.toString() ?? null,
      latestBlockchainStatus: latestBlockchainTransaction?.status ?? null,
      hasLedgerJournal: Boolean(settlementLedgerJournal),
      hasSettlementProof: Boolean(settlementProof)
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
        destinationWalletId: record.destinationWalletId,
        destinationWalletAddress: record.destinationWallet?.address ?? null,
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
      settlementProof: settlementProof
        ? {
            id: settlementProof.id,
            ledgerJournalId: settlementProof.ledgerJournalId,
            blockchainTransactionId: settlementProof.blockchainTransactionId,
            txHash: settlementProof.txHash,
            fromAddress: settlementProof.fromAddress,
            toAddress: settlementProof.toAddress,
            settledAmount: settlementProof.settledAmount.toString(),
            confirmedAt: settlementProof.confirmedAt.toISOString(),
            createdAt: settlementProof.createdAt.toISOString()
          }
        : null,
      reconciliation
    };
  }

  private async findRecordByIntentId(
    intentId: string
  ): Promise<DepositSettlementReconciliationRecord | null> {
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
        },
        ledgerJournals: {
          where: {
            journalType: LedgerJournalType.deposit_settlement
          },
          take: 1,
          select: {
            id: true,
            journalType: true,
            postedAt: true,
            createdAt: true
          }
        },
        depositSettlementProof: {
          select: {
            id: true,
            ledgerJournalId: true,
            blockchainTransactionId: true,
            txHash: true,
            fromAddress: true,
            toAddress: true,
            settledAmount: true,
            confirmedAt: true,
            createdAt: true
          }
        }
      }
    });
  }

  private async findReplayApprovalRequestById(
    requestId: string
  ): Promise<DepositSettlementReplayApprovalRequestRecord | null> {
    return this.prismaService.depositSettlementReplayApprovalRequest.findUnique({
      where: {
        id: requestId
      },
      include: {
        transactionIntent: {
          select: {
            id: true,
            chainId: true
          }
        }
      }
    });
  }

  private assertReplayActionMatches(
    item: DepositSettlementReconciliationItem,
    replayAction: DepositSettlementReplayAction
  ): void {
    if (item.reconciliation.replayAction !== replayAction) {
      throw new ConflictException(
        replayAction === DepositSettlementReplayAction.confirm
          ? "Deposit transaction intent is not in a state that supports confirm replay."
          : "Deposit transaction intent is not in a state that supports settle replay."
      );
    }
  }

  async listDepositSettlementReconciliation(
    query: ListDepositSettlementReconciliationDto
  ): Promise<ListDepositSettlementReconciliationResult> {
    const limit = query.limit ?? 20;

    const records = await this.prismaService.transactionIntent.findMany({
      where: {
        intentType: TransactionIntentType.deposit,
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
        },
        ledgerJournals: {
          where: {
            journalType: LedgerJournalType.deposit_settlement
          },
          take: 1,
          select: {
            id: true,
            journalType: true,
            postedAt: true,
            createdAt: true
          }
        },
        depositSettlementProof: {
          select: {
            id: true,
            ledgerJournalId: true,
            blockchainTransactionId: true,
            txHash: true,
            fromAddress: true,
            toAddress: true,
            settledAmount: true,
            confirmedAt: true,
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

  async listReplayApprovalRequests(query: {
    limit?: number;
    status?: DepositSettlementReplayApprovalRequestStatus;
  }): Promise<ListDepositSettlementReplayApprovalRequestsResult> {
    const limit = query.limit ?? 25;
    const where: Prisma.DepositSettlementReplayApprovalRequestWhereInput = {
      ...(query.status ? { status: query.status } : {})
    };

    const [requests, totalCount, byStatus] = await Promise.all([
      this.prismaService.depositSettlementReplayApprovalRequest.findMany({
        where,
        orderBy: {
          requestedAt: "desc"
        },
        take: limit,
        include: {
          transactionIntent: {
            select: {
              id: true,
              customerAccountId: true,
              chainId: true,
              status: true,
              requestedAmount: true,
              settledAmount: true,
              createdAt: true,
              updatedAt: true,
              asset: {
                select: {
                  id: true,
                  symbol: true,
                  displayName: true,
                  decimals: true,
                  chainId: true
                }
              },
              customerAccount: {
                select: {
                  id: true,
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
          }
        }
      }),
      this.prismaService.depositSettlementReplayApprovalRequest.count({
        where
      }),
      this.prismaService.depositSettlementReplayApprovalRequest.groupBy({
        by: ["status"],
        where,
        _count: {
          _all: true
        }
      })
    ]);

    return {
      requests: requests.map((request) => this.mapReplayApprovalQueueItem(request)),
      limit,
      totalCount,
      summary: {
        byStatus: byStatus.map((entry) => ({
          status: entry.status,
          count: entry._count._all
        }))
      }
    };
  }

  async approveReplayApprovalRequest(
    requestId: string,
    operatorId: string,
    operatorRole: string | null,
    note?: string | null
  ): Promise<DepositSettlementReplayApprovalRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const approvalRequest = await this.findReplayApprovalRequestById(requestId);

    if (!approvalRequest) {
      throw new NotFoundException("Deposit replay approval request was not found.");
    }

    if (
      approvalRequest.status ===
      DepositSettlementReplayApprovalRequestStatus.approved
    ) {
      return {
        request: this.mapReplayApprovalRequest(approvalRequest),
        stateReused: true
      };
    }

    if (
      approvalRequest.status !==
      DepositSettlementReplayApprovalRequestStatus.pending_approval
    ) {
      throw new ConflictException(
        "Only pending deposit replay approval requests can be approved."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Deposit replay approval requires a different approver than the requester."
      );
    }

    const normalizedApprovalNote = note?.trim() || null;
    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest =
          await transaction.depositSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: DepositSettlementReplayApprovalRequestStatus.approved,
              approvedByOperatorId: operatorId,
              approvedByOperatorRole: normalizedOperatorRole,
              approvalNote: normalizedApprovalNote ?? undefined,
              approvedAt: new Date(),
              rejectedByOperatorId: null,
              rejectedByOperatorRole: null,
              rejectionNote: null,
              rejectedAt: null
            },
            include: {
              transactionIntent: {
                select: {
                  id: true,
                  chainId: true
                }
              }
            }
          });

        await transaction.auditEvent.create({
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "transaction_intent.deposit.replay_approval_approved",
            targetType: "DepositSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: approvalRequest.transactionIntentId,
              replayAction: approvalRequest.replayAction,
              requestedByOperatorId: approvalRequest.requestedByOperatorId,
              requestedByOperatorRole: approvalRequest.requestedByOperatorRole,
              approvedByOperatorId: operatorId,
              approvedByOperatorRole: normalizedOperatorRole,
              approvalNote: normalizedApprovalNote,
              chainId: approvalRequest.chainId
            }
          }
        });

        return nextRequest;
      }
    );

    return {
      request: this.mapReplayApprovalRequest(updatedRequest),
      stateReused: false
    };
  }

  async rejectReplayApprovalRequest(
    requestId: string,
    operatorId: string,
    operatorRole: string | null,
    note: string
  ): Promise<DepositSettlementReplayApprovalRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const approvalRequest = await this.findReplayApprovalRequestById(requestId);

    if (!approvalRequest) {
      throw new NotFoundException("Deposit replay approval request was not found.");
    }

    if (
      approvalRequest.status ===
      DepositSettlementReplayApprovalRequestStatus.rejected
    ) {
      return {
        request: this.mapReplayApprovalRequest(approvalRequest),
        stateReused: true
      };
    }

    if (
      approvalRequest.status !==
      DepositSettlementReplayApprovalRequestStatus.pending_approval
    ) {
      throw new ConflictException(
        "Only pending deposit replay approval requests can be rejected."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Deposit replay approval requires a different reviewer than the requester."
      );
    }

    const normalizedRejectionNote = note.trim();

    if (!normalizedRejectionNote) {
      throw new ConflictException(
        "A rejection note is required to reject a deposit replay approval request."
      );
    }

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest =
          await transaction.depositSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: DepositSettlementReplayApprovalRequestStatus.rejected,
              rejectedByOperatorId: operatorId,
              rejectedByOperatorRole: normalizedOperatorRole,
              rejectionNote: normalizedRejectionNote,
              rejectedAt: new Date()
            },
            include: {
              transactionIntent: {
                select: {
                  id: true,
                  chainId: true
                }
              }
            }
          });

        await transaction.auditEvent.create({
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "transaction_intent.deposit.replay_approval_rejected",
            targetType: "DepositSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: approvalRequest.transactionIntentId,
              replayAction: approvalRequest.replayAction,
              requestedByOperatorId: approvalRequest.requestedByOperatorId,
              requestedByOperatorRole: approvalRequest.requestedByOperatorRole,
              rejectedByOperatorId: operatorId,
              rejectedByOperatorRole: normalizedOperatorRole,
              rejectionNote: normalizedRejectionNote,
              chainId: approvalRequest.chainId
            }
          }
        });

        return nextRequest;
      }
    );

    return {
      request: this.mapReplayApprovalRequest(updatedRequest),
      stateReused: false
    };
  }

  async executeReplayApprovalRequest(
    requestId: string,
    operatorId: string,
    operatorRole: string | null,
    note?: string | null
  ) {
    const approvalRequest = await this.findReplayApprovalRequestById(requestId);

    if (!approvalRequest) {
      throw new NotFoundException("Deposit replay approval request was not found.");
    }

    if (approvalRequest.replayAction === DepositSettlementReplayAction.confirm) {
      return this.replayConfirm(
        approvalRequest.transactionIntentId,
        operatorId,
        operatorRole,
        {
          approvalRequestId: approvalRequest.id,
          note: note?.trim() || undefined
        }
      );
    }

    return this.replaySettle(
      approvalRequest.transactionIntentId,
      operatorId,
      operatorRole,
      {
        approvalRequestId: approvalRequest.id,
        note: note?.trim() || undefined
      }
    );
  }

  async requestReplayApproval(
    intentId: string,
    operatorId: string,
    operatorRole: string | null,
    dto: RequestDepositSettlementReplayApprovalDto
  ): Promise<DepositSettlementReplayApprovalRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const item = this.mapItem(record);
    this.assertReplayActionMatches(item, dto.replayAction);

    const normalizedRequestNote = dto.note?.trim() || null;
    const existingPendingRequest =
      await this.prismaService.depositSettlementReplayApprovalRequest.findFirst({
        where: {
          transactionIntentId: intentId,
          replayAction: dto.replayAction,
          status: {
            in: [
              DepositSettlementReplayApprovalRequestStatus.pending_approval,
              DepositSettlementReplayApprovalRequestStatus.approved
            ]
          }
        },
        include: {
          transactionIntent: {
            select: {
              id: true,
              chainId: true
            }
          }
        },
        orderBy: {
          requestedAt: "desc"
        }
      });

    if (existingPendingRequest) {
      if (existingPendingRequest.requestedByOperatorId !== operatorId) {
        throw new ConflictException(
          "A governed replay approval already exists for this deposit intent and replay action."
        );
      }

      return {
        request: this.mapReplayApprovalRequest(existingPendingRequest),
        stateReused: true
      };
    }

    const createdRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest =
          await transaction.depositSettlementReplayApprovalRequest.create({
            data: {
              transactionIntentId: item.intent.id,
              chainId: item.intent.chainId,
              replayAction: dto.replayAction,
              status: DepositSettlementReplayApprovalRequestStatus.pending_approval,
              requestedByOperatorId: operatorId,
              requestedByOperatorRole: normalizedOperatorRole,
              requestNote: normalizedRequestNote ?? undefined
            },
            include: {
              transactionIntent: {
                select: {
                  id: true,
                  chainId: true
                }
              }
            }
          });

        await transaction.auditEvent.create({
          data: {
            customerId: item.intent.customer.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "transaction_intent.deposit.replay_approval_requested",
            targetType: "DepositSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: item.intent.id,
              replayAction: dto.replayAction,
              reconciliationState: item.reconciliation.state,
              reconciliationReasonCode: item.reconciliation.reasonCode,
              operatorRole: normalizedOperatorRole,
              requestNote: normalizedRequestNote,
              chainId: item.intent.chainId
            }
          }
        });

        return nextRequest;
      }
    );

    return {
      request: this.mapReplayApprovalRequest(createdRequest),
      stateReused: false
    };
  }

  async replayConfirm(
    intentId: string,
    operatorId: string,
    operatorRole: string | null,
    dto: ReplayDepositSettlementStepDto
  ) {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const normalizedApprovalNote = dto.note?.trim() || null;
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const item = this.mapItem(record);

    this.assertReplayActionMatches(item, DepositSettlementReplayAction.confirm);

    const approvalRequest = await this.findReplayApprovalRequestById(
      dto.approvalRequestId
    );

    if (!approvalRequest || approvalRequest.transactionIntentId !== intentId) {
      throw new NotFoundException(
        "Deposit replay approval request was not found."
      );
    }

    if (
      approvalRequest.status !==
      DepositSettlementReplayApprovalRequestStatus.approved
    ) {
      throw new ConflictException(
        "Deposit replay approval request must be approved before confirm replay can execute."
      );
    }

    if (approvalRequest.replayAction !== DepositSettlementReplayAction.confirm) {
      throw new ConflictException(
        "Deposit replay approval request does not authorize confirm replay."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Deposit replay approval requires a different operator than the requester."
      );
    }

    const result = await this.transactionIntentsService.replayConfirmDepositIntent(
      intentId,
      operatorId,
      normalizedApprovalNote,
      normalizedOperatorRole,
      {
        approvalRequestId: approvalRequest.id,
        requestedByOperatorId: approvalRequest.requestedByOperatorId,
        requestedByOperatorRole: approvalRequest.requestedByOperatorRole
      }
    );

    const executedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const now = new Date();
        const nextRequest =
          await transaction.depositSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: DepositSettlementReplayApprovalRequestStatus.executed,
              approvedByOperatorId:
                approvalRequest.approvedByOperatorId ?? operatorId,
              approvedByOperatorRole:
                approvalRequest.approvedByOperatorRole ?? normalizedOperatorRole,
              approvalNote: approvalRequest.approvalNote ?? undefined,
              approvedAt: approvalRequest.approvedAt ?? now,
              executedByOperatorId: operatorId,
              executedByOperatorRole: normalizedOperatorRole,
              executedAt: now
            },
            include: {
              transactionIntent: {
                select: {
                  id: true,
                  chainId: true
                }
              }
            }
          });

        await transaction.auditEvent.create({
          data: {
            customerId: item.intent.customer.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "transaction_intent.deposit.replay_executed",
            targetType: "DepositSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: intentId,
              replayAction: DepositSettlementReplayAction.confirm,
              requestedByOperatorId: approvalRequest.requestedByOperatorId,
              requestedByOperatorRole: approvalRequest.requestedByOperatorRole,
              approvedByOperatorId:
                approvalRequest.approvedByOperatorId ?? operatorId,
              approvedByOperatorRole:
                approvalRequest.approvedByOperatorRole ?? normalizedOperatorRole,
              executedByOperatorId: operatorId,
              executedByOperatorRole: normalizedOperatorRole,
              requestNote: approvalRequest.requestNote ?? null,
              approvalNote: approvalRequest.approvalNote ?? null,
              executionNote: normalizedApprovalNote,
              chainId: item.intent.chainId
            }
          }
        });

        return nextRequest;
      }
    );

    return {
      ...result,
      approvalRequest: this.mapReplayApprovalRequest(executedRequest)
    };
  }

  async replaySettle(
    intentId: string,
    operatorId: string,
    operatorRole: string | null,
    dto: ReplayDepositSettlementStepDto
  ) {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const normalizedApprovalNote = dto.note?.trim() || null;
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const item = this.mapItem(record);

    this.assertReplayActionMatches(item, DepositSettlementReplayAction.settle);

    const approvalRequest = await this.findReplayApprovalRequestById(
      dto.approvalRequestId
    );

    if (!approvalRequest || approvalRequest.transactionIntentId !== intentId) {
      throw new NotFoundException(
        "Deposit replay approval request was not found."
      );
    }

    if (
      approvalRequest.status !==
      DepositSettlementReplayApprovalRequestStatus.approved
    ) {
      throw new ConflictException(
        "Deposit replay approval request must be approved before settle replay can execute."
      );
    }

    if (approvalRequest.replayAction !== DepositSettlementReplayAction.settle) {
      throw new ConflictException(
        "Deposit replay approval request does not authorize settle replay."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Deposit replay approval requires a different operator than the requester."
      );
    }

    const result =
      await this.transactionIntentsService.replaySettleConfirmedDepositIntent(
      intentId,
      operatorId,
      normalizedApprovalNote,
      normalizedOperatorRole,
      {
        approvalRequestId: approvalRequest.id,
        requestedByOperatorId: approvalRequest.requestedByOperatorId,
        requestedByOperatorRole: approvalRequest.requestedByOperatorRole
      }
    );

    const executedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const now = new Date();
        const nextRequest =
          await transaction.depositSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: DepositSettlementReplayApprovalRequestStatus.executed,
              approvedByOperatorId:
                approvalRequest.approvedByOperatorId ?? operatorId,
              approvedByOperatorRole:
                approvalRequest.approvedByOperatorRole ?? normalizedOperatorRole,
              approvalNote: approvalRequest.approvalNote ?? undefined,
              approvedAt: approvalRequest.approvedAt ?? now,
              executedByOperatorId: operatorId,
              executedByOperatorRole: normalizedOperatorRole,
              executedAt: now
            },
            include: {
              transactionIntent: {
                select: {
                  id: true,
                  chainId: true
                }
              }
            }
          });

        await transaction.auditEvent.create({
          data: {
            customerId: item.intent.customer.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "transaction_intent.deposit.replay_executed",
            targetType: "DepositSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: intentId,
              replayAction: DepositSettlementReplayAction.settle,
              requestedByOperatorId: approvalRequest.requestedByOperatorId,
              requestedByOperatorRole: approvalRequest.requestedByOperatorRole,
              approvedByOperatorId:
                approvalRequest.approvedByOperatorId ?? operatorId,
              approvedByOperatorRole:
                approvalRequest.approvedByOperatorRole ?? normalizedOperatorRole,
              executedByOperatorId: operatorId,
              executedByOperatorRole: normalizedOperatorRole,
              requestNote: approvalRequest.requestNote ?? null,
              approvalNote: approvalRequest.approvalNote ?? null,
              executionNote: normalizedApprovalNote,
              chainId: item.intent.chainId
            }
          }
        });

        return nextRequest;
      }
    );

    return {
      ...result,
      approvalRequest: this.mapReplayApprovalRequest(executedRequest)
    };
  }

  async openManualReviewCase(
    intentId: string,
    operatorId: string,
    dto: OpenReconciliationReviewCaseDto
  ) {
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Deposit transaction intent not found.");
    }

    const item = this.mapItem(record);

    if (item.reconciliation.state !== "manual_review_required") {
      throw new ConflictException(
        "Deposit transaction intent is not in a manual-review-required reconciliation state."
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
        intentType: "deposit",
        reconciliationState: item.reconciliation.state,
        reconciliationReason: item.reconciliation.reason,
        replayAction: item.reconciliation.replayAction,
        chainId: item.intent.chainId
      }
    });
  }
}
