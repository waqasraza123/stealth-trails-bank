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
  LedgerJournalType,
  Prisma,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType,
  WithdrawalSettlementReplayAction,
  WithdrawalSettlementReplayApprovalRequestStatus
} from "@prisma/client";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import { OpenReconciliationReviewCaseDto } from "../review-cases/dto/open-reconciliation-review-case.dto";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { ListWithdrawalSettlementReconciliationDto } from "./dto/list-withdrawal-settlement-reconciliation.dto";
import { ReplayWithdrawalSettlementStepDto } from "./dto/replay-withdrawal-settlement-step.dto";
import { RequestWithdrawalSettlementReplayApprovalDto } from "./dto/request-withdrawal-settlement-replay-approval.dto";
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

type WithdrawalSettlementReplayApprovalRequestRecord =
  Prisma.WithdrawalSettlementReplayApprovalRequestGetPayload<{
    include: {
      transactionIntent: {
        select: {
          id: true;
          chainId: true;
        };
      };
    };
  }>;

type WithdrawalSettlementReplayApprovalRequestProjection = {
  id: string;
  transactionIntentId: string;
  chainId: number;
  replayAction: WithdrawalSettlementReplayAction;
  status: WithdrawalSettlementReplayApprovalRequestStatus;
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

type WithdrawalSettlementReplayApprovalRequestMutationResult = {
  request: WithdrawalSettlementReplayApprovalRequestProjection;
  stateReused: boolean;
};

type ListWithdrawalSettlementReplayApprovalRequestsResult = {
  requests: WithdrawalSettlementReplayApprovalQueueItem[];
  limit: number;
  totalCount: number;
  summary: {
    byStatus: Array<{
      status: WithdrawalSettlementReplayApprovalRequestStatus;
      count: number;
    }>;
  };
};

type WithdrawalSettlementReplayApprovalQueueItem = {
  request: WithdrawalSettlementReplayApprovalRequestProjection;
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

type WithdrawalSettlementReplayApprovalQueueRecord =
  Prisma.WithdrawalSettlementReplayApprovalRequestGetPayload<{
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
export class WithdrawalSettlementReconciliationService {
  private readonly productChainId: number;
  private readonly custodyOperationAllowedOperatorRoles: readonly string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly withdrawalIntentsService: WithdrawalIntentsService,
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
      "Operator role is not authorized to execute governed withdrawal replay actions."
    );
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

  private mapReplayApprovalRequest(
    request: WithdrawalSettlementReplayApprovalRequestRecord
  ): WithdrawalSettlementReplayApprovalRequestProjection {
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
    request: WithdrawalSettlementReplayApprovalQueueRecord
  ): WithdrawalSettlementReplayApprovalQueueItem {
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

  private async findReplayApprovalRequestById(
    requestId: string
  ): Promise<WithdrawalSettlementReplayApprovalRequestRecord | null> {
    return this.prismaService.withdrawalSettlementReplayApprovalRequest.findUnique({
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
    item: WithdrawalSettlementReconciliationItem,
    replayAction: WithdrawalSettlementReplayAction
  ): void {
    if (item.reconciliation.replayAction !== replayAction) {
      throw new ConflictException(
        replayAction === WithdrawalSettlementReplayAction.confirm
          ? "Withdrawal transaction intent is not in a state that supports confirm replay."
          : "Withdrawal transaction intent is not in a state that supports settle replay."
      );
    }
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

  async listReplayApprovalRequests(query: {
    limit?: number;
    status?: WithdrawalSettlementReplayApprovalRequestStatus;
  }): Promise<ListWithdrawalSettlementReplayApprovalRequestsResult> {
    const limit = query.limit ?? 25;
    const where: Prisma.WithdrawalSettlementReplayApprovalRequestWhereInput = {
      ...(query.status ? { status: query.status } : {})
    };

    const [requests, totalCount, byStatus] = await Promise.all([
      this.prismaService.withdrawalSettlementReplayApprovalRequest.findMany({
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
      this.prismaService.withdrawalSettlementReplayApprovalRequest.count({
        where
      }),
      this.prismaService.withdrawalSettlementReplayApprovalRequest.groupBy({
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
  ): Promise<WithdrawalSettlementReplayApprovalRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const approvalRequest = await this.findReplayApprovalRequestById(requestId);

    if (!approvalRequest) {
      throw new NotFoundException(
        "Withdrawal replay approval request was not found."
      );
    }

    if (
      approvalRequest.status ===
      WithdrawalSettlementReplayApprovalRequestStatus.approved
    ) {
      return {
        request: this.mapReplayApprovalRequest(approvalRequest),
        stateReused: true
      };
    }

    if (
      approvalRequest.status !==
      WithdrawalSettlementReplayApprovalRequestStatus.pending_approval
    ) {
      throw new ConflictException(
        "Only pending withdrawal replay approval requests can be approved."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Withdrawal replay approval requires a different approver than the requester."
      );
    }

    const normalizedApprovalNote = note?.trim() || null;
    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest =
          await transaction.withdrawalSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: WithdrawalSettlementReplayApprovalRequestStatus.approved,
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
            action: "transaction_intent.withdrawal.replay_approval_approved",
            targetType: "WithdrawalSettlementReplayApprovalRequest",
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
  ): Promise<WithdrawalSettlementReplayApprovalRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const approvalRequest = await this.findReplayApprovalRequestById(requestId);

    if (!approvalRequest) {
      throw new NotFoundException(
        "Withdrawal replay approval request was not found."
      );
    }

    if (
      approvalRequest.status ===
      WithdrawalSettlementReplayApprovalRequestStatus.rejected
    ) {
      return {
        request: this.mapReplayApprovalRequest(approvalRequest),
        stateReused: true
      };
    }

    if (
      approvalRequest.status !==
      WithdrawalSettlementReplayApprovalRequestStatus.pending_approval
    ) {
      throw new ConflictException(
        "Only pending withdrawal replay approval requests can be rejected."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Withdrawal replay approval requires a different reviewer than the requester."
      );
    }

    const normalizedRejectionNote = note.trim();

    if (!normalizedRejectionNote) {
      throw new ConflictException(
        "A rejection note is required to reject a withdrawal replay approval request."
      );
    }

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest =
          await transaction.withdrawalSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: WithdrawalSettlementReplayApprovalRequestStatus.rejected,
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
            action: "transaction_intent.withdrawal.replay_approval_rejected",
            targetType: "WithdrawalSettlementReplayApprovalRequest",
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
      throw new NotFoundException(
        "Withdrawal replay approval request was not found."
      );
    }

    if (approvalRequest.replayAction === WithdrawalSettlementReplayAction.confirm) {
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
    dto: RequestWithdrawalSettlementReplayApprovalDto
  ): Promise<WithdrawalSettlementReplayApprovalRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const item = this.mapItem(record);
    this.assertReplayActionMatches(item, dto.replayAction);

    const normalizedRequestNote = dto.note?.trim() || null;
    const existingPendingRequest =
      await this.prismaService.withdrawalSettlementReplayApprovalRequest.findFirst({
        where: {
          transactionIntentId: intentId,
          replayAction: dto.replayAction,
          status: {
            in: [
              WithdrawalSettlementReplayApprovalRequestStatus.pending_approval,
              WithdrawalSettlementReplayApprovalRequestStatus.approved
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
          "A governed replay approval already exists for this withdrawal intent and replay action."
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
          await transaction.withdrawalSettlementReplayApprovalRequest.create({
            data: {
              transactionIntentId: item.intent.id,
              chainId: item.intent.chainId,
              replayAction: dto.replayAction,
              status:
                WithdrawalSettlementReplayApprovalRequestStatus.pending_approval,
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
            action: "transaction_intent.withdrawal.replay_approval_requested",
            targetType: "WithdrawalSettlementReplayApprovalRequest",
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
    dto: ReplayWithdrawalSettlementStepDto
  ) {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const normalizedApprovalNote = dto.note?.trim() || null;
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const item = this.mapItem(record);
    this.assertReplayActionMatches(item, WithdrawalSettlementReplayAction.confirm);

    const approvalRequest = await this.findReplayApprovalRequestById(
      dto.approvalRequestId
    );

    if (!approvalRequest || approvalRequest.transactionIntentId !== intentId) {
      throw new NotFoundException(
        "Withdrawal replay approval request was not found."
      );
    }

    if (
      approvalRequest.status !==
      WithdrawalSettlementReplayApprovalRequestStatus.approved
    ) {
      throw new ConflictException(
        "Withdrawal replay approval request must be approved before confirm replay can execute."
      );
    }

    if (approvalRequest.replayAction !== WithdrawalSettlementReplayAction.confirm) {
      throw new ConflictException(
        "Withdrawal replay approval request does not authorize confirm replay."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Withdrawal replay approval requires a different operator than the requester."
      );
    }

    const result = await this.withdrawalIntentsService.replayConfirmWithdrawalIntent(
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
          await transaction.withdrawalSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: WithdrawalSettlementReplayApprovalRequestStatus.executed,
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
            action: "transaction_intent.withdrawal.replay_executed",
            targetType: "WithdrawalSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: intentId,
              replayAction: WithdrawalSettlementReplayAction.confirm,
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
    dto: ReplayWithdrawalSettlementStepDto
  ) {
    const normalizedOperatorRole = this.assertCanOperateCustody(operatorRole);
    const normalizedApprovalNote = dto.note?.trim() || null;
    const record = await this.findRecordByIntentId(intentId);

    if (!record) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    const item = this.mapItem(record);
    this.assertReplayActionMatches(item, WithdrawalSettlementReplayAction.settle);

    const approvalRequest = await this.findReplayApprovalRequestById(
      dto.approvalRequestId
    );

    if (!approvalRequest || approvalRequest.transactionIntentId !== intentId) {
      throw new NotFoundException(
        "Withdrawal replay approval request was not found."
      );
    }

    if (
      approvalRequest.status !==
      WithdrawalSettlementReplayApprovalRequestStatus.approved
    ) {
      throw new ConflictException(
        "Withdrawal replay approval request must be approved before settle replay can execute."
      );
    }

    if (approvalRequest.replayAction !== WithdrawalSettlementReplayAction.settle) {
      throw new ConflictException(
        "Withdrawal replay approval request does not authorize settle replay."
      );
    }

    if (approvalRequest.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Withdrawal replay approval requires a different operator than the requester."
      );
    }

    const result =
      await this.withdrawalIntentsService.replaySettleConfirmedWithdrawalIntent(
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
          await transaction.withdrawalSettlementReplayApprovalRequest.update({
            where: {
              id: approvalRequest.id
            },
            data: {
              status: WithdrawalSettlementReplayApprovalRequestStatus.executed,
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
            action: "transaction_intent.withdrawal.replay_executed",
            targetType: "WithdrawalSettlementReplayApprovalRequest",
            targetId: nextRequest.id,
            metadata: {
              transactionIntentId: intentId,
              replayAction: WithdrawalSettlementReplayAction.settle,
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
