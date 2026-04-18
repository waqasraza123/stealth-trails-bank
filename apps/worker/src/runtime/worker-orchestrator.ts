import { createHash } from "node:crypto";
import { ManagedExecutionIntentError } from "./deposit-broadcaster";
import type { InternalWorkerApiClient } from "./internal-worker-api-client";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  BroadcastReceipt,
  ManagedDepositBroadcaster,
  ListIntentsResult,
  ManagedWithdrawalBroadcaster,
  PolicyControlledWithdrawalBroadcaster,
  PreparedManagedWithdrawalTransaction,
  RecordBroadcastPayload,
  WorkerIntentProjection,
  WorkerIterationMetrics,
  WorkerLogger
} from "./worker-types";

type JsonRpcClient = {
  getBlockNumber(): Promise<bigint>;
  getTransactionReceipt(txHash: string): Promise<BroadcastReceipt | null>;
};

type WorkerOrchestratorDeps = {
  runtime: WorkerRuntime;
  internalApiClient: InternalWorkerApiClient;
  rpcClient: JsonRpcClient | null;
  depositBroadcaster: ManagedDepositBroadcaster | null;
  withdrawalBroadcaster: ManagedWithdrawalBroadcaster | null;
  policyControlledWithdrawalBroadcaster: PolicyControlledWithdrawalBroadcaster | null;
  logger: WorkerLogger;
};

const SYNTHETIC_TREASURY_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function buildSyntheticTxHash(
  intentId: string,
  phase: "deposit" | "withdrawal"
): string {
  const hash = createHash("sha256")
    .update(`${phase}:${intentId}:${Date.now().toString(10)}`)
    .digest("hex");

  return `0x${hash}`;
}

function stringifyIntentIds(intents: WorkerIntentProjection[]): string[] {
  return intents.map((intent) => intent.id);
}

function createEmptyIterationMetrics(): WorkerIterationMetrics {
  return {
    queuedDepositCount: 0,
    queuedWithdrawalCount: 0,
    claimableGovernedExecutionRequestCount: 0,
    claimedGovernedExecutionRequestCount: 0,
    dispatchedGovernedExecutionRequestCount: 0,
    governedExecutionDispatchFailureCount: 0,
    signedWithdrawalCount: 0,
    broadcastDepositCount: 0,
    broadcastWithdrawalCount: 0,
    confirmedDepositReadyToSettleCount: 0,
    confirmedWithdrawalReadyToSettleCount: 0,
    depositBroadcastRecordedCount: 0,
    withdrawalBroadcastRecordedCount: 0,
    depositConfirmedCount: 0,
    withdrawalConfirmedCount: 0,
    depositSettledCount: 0,
    withdrawalSettledCount: 0,
    depositFailedCount: 0,
    withdrawalFailedCount: 0,
    retryableWithdrawalFailureCount: 0,
    manualWithdrawalBacklogCount: 0,
    awaitingFundingLoanCount: 0,
    fundedLoanCount: 0,
    dueLoanInstallmentCount: 0,
    autopayLoanSweepCount: 0,
    autopayLoanSuccessCount: 0,
    autopayLoanFailureCount: 0,
    valuationRefreshCandidateCount: 0,
    valuationRefreshCount: 0,
    graceExpiredLoanCount: 0,
    defaultEscalatedLoanCount: 0,
    liquidationCandidateCount: 0,
    reEscalatedCriticalAlertCount: 0
  };
}

export class WorkerOrchestrator {
  private lastGovernedExecutionDispatchAttemptedAt = 0;

  constructor(private readonly deps: WorkerOrchestratorDeps) {}

  async runOnce(): Promise<WorkerIterationMetrics> {
    const metrics = createEmptyIterationMetrics();
    const queuedDeposits = await this.deps.internalApiClient.listQueuedDepositIntents(
      this.deps.runtime.batchLimit
    );
    const queuedWithdrawals =
      await this.deps.internalApiClient.listQueuedWithdrawalIntents(
        this.deps.runtime.batchLimit
      );

    metrics.queuedDepositCount = queuedDeposits.intents.length;
    metrics.queuedWithdrawalCount = queuedWithdrawals.intents.length;

    if (this.deps.runtime.executionMode === "synthetic") {
      await this.processQueuedDepositsSynthetic(queuedDeposits, metrics);
      await this.processQueuedWithdrawalsSynthetic(queuedWithdrawals, metrics);
    } else if (this.deps.runtime.executionMode === "managed") {
      await this.processQueuedDepositsManaged(queuedDeposits, metrics);
      await this.processQueuedWithdrawalsManaged(queuedWithdrawals, metrics);
    } else {
      this.logQueuedBacklog("deposit", queuedDeposits);
      this.logQueuedBacklog("withdrawal", queuedWithdrawals);
    }

    const broadcastDeposits =
      await this.deps.internalApiClient.listBroadcastDepositIntents(
        this.deps.runtime.batchLimit
      );
    const broadcastWithdrawals =
      await this.deps.internalApiClient.listBroadcastWithdrawalIntents(
        this.deps.runtime.batchLimit
      );

    metrics.broadcastDepositCount = broadcastDeposits.intents.length;
    metrics.broadcastWithdrawalCount = broadcastWithdrawals.intents.length;

    if (this.deps.runtime.executionMode === "synthetic") {
      await this.processBroadcastDepositsSynthetic(broadcastDeposits, metrics);
      await this.processBroadcastWithdrawalsSynthetic(broadcastWithdrawals, metrics);
    } else {
      await this.processBroadcastDepositsMonitor(broadcastDeposits, metrics);
      await this.processBroadcastWithdrawalsMonitor(broadcastWithdrawals, metrics);
    }

    const confirmedDepositsReadyToSettle =
      await this.deps.internalApiClient.listConfirmedDepositIntentsReadyToSettle(
        this.deps.runtime.batchLimit
      );
    const confirmedWithdrawalsReadyToSettle =
      await this.deps.internalApiClient.listConfirmedWithdrawalIntentsReadyToSettle(
        this.deps.runtime.batchLimit
      );

    metrics.confirmedDepositReadyToSettleCount =
      confirmedDepositsReadyToSettle.intents.length;
    metrics.confirmedWithdrawalReadyToSettleCount =
      confirmedWithdrawalsReadyToSettle.intents.length;

    await this.processConfirmedDepositsReadyToSettle(
      confirmedDepositsReadyToSettle,
      metrics
    );
    await this.processConfirmedWithdrawalsReadyToSettle(
      confirmedWithdrawalsReadyToSettle,
      metrics
    );

    const now = Date.now();
    if (
      now - this.lastGovernedExecutionDispatchAttemptedAt >=
      this.deps.runtime.governedExecutionDispatchIntervalMs
    ) {
      this.lastGovernedExecutionDispatchAttemptedAt = now;
      const claimableGovernedExecutionRequests =
        await this.deps.internalApiClient.listClaimableGovernedExecutionRequests(
          this.deps.runtime.batchLimit
        );
      metrics.claimableGovernedExecutionRequestCount =
        claimableGovernedExecutionRequests.requests.length;
      await this.processGovernedExecutionRequests(
        claimableGovernedExecutionRequests.requests,
        metrics
      );
    }

    const awaitingFundingLoans =
      await this.deps.internalApiClient.listAwaitingFundingLoans(
        this.deps.runtime.batchLimit
      );
    metrics.awaitingFundingLoanCount = awaitingFundingLoans.agreements.length;
    await this.processAwaitingFundingLoans(awaitingFundingLoans.agreements, metrics);

    const dueInstallments =
      await this.deps.internalApiClient.listDueLoanInstallments(
        this.deps.runtime.batchLimit
      );
    metrics.dueLoanInstallmentCount = dueInstallments.installments.length;
    await this.processDueLoanInstallments(dueInstallments.installments, metrics);

    const valuationMonitorLoans =
      await this.deps.internalApiClient.listValuationMonitorLoans(
        this.deps.runtime.batchLimit
      );
    metrics.valuationRefreshCandidateCount = valuationMonitorLoans.agreements.length;
    await this.processLoanValuationRefreshes(valuationMonitorLoans.agreements, metrics);

    const graceExpiredLoans =
      await this.deps.internalApiClient.listGracePeriodExpiredLoans(
        this.deps.runtime.batchLimit
      );
    metrics.graceExpiredLoanCount = graceExpiredLoans.agreements.length;
    await this.processExpiredGracePeriodLoans(graceExpiredLoans.agreements, metrics);

    const liquidationCandidates =
      await this.deps.internalApiClient.listLoanLiquidationCandidates(
        this.deps.runtime.batchLimit
      );
    metrics.liquidationCandidateCount = liquidationCandidates.agreements.length;
    if (liquidationCandidates.agreements.length > 0) {
      this.deps.logger.warn("loan_liquidation_candidates_detected", {
        count: liquidationCandidates.agreements.length,
        loanAgreementIds: liquidationCandidates.agreements.map(
          (agreement) => agreement.loanAgreementId
        )
      });
    }

    return metrics;
  }

  private async processAwaitingFundingLoans(
    agreements: Array<{ loanAgreementId: string }>,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const agreement of agreements) {
      await this.deps.internalApiClient.fundLoanAgreement(agreement.loanAgreementId);
      metrics.fundedLoanCount += 1;
      this.deps.logger.info("loan_funding_completed", {
        loanAgreementId: agreement.loanAgreementId
      });
    }
  }

  private async processGovernedExecutionRequests(
    requests: Array<{
      id: string;
      executionType: string;
      targetType: string;
      targetId: string;
      executionPackageHash: string | null;
      dispatchStatus: string;
    }>,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const request of requests) {
      try {
        const claimResult =
          await this.deps.internalApiClient.claimGovernedExecutionRequest(
            request.id
          );
        metrics.claimedGovernedExecutionRequestCount += claimResult.claimReused
          ? 0
          : 1;

        const dispatchReference = [
          "worker",
          this.deps.runtime.workerId,
          request.id,
          Date.now().toString(10)
        ].join(":");
        const dispatchResult =
          await this.deps.internalApiClient.dispatchGovernedExecutionRequest(
            request.id,
            {
              dispatchReference,
              dispatchNote:
                "Worker verified the signed governed execution package and staged the governed executor handoff."
            }
          );

        if (dispatchResult.verificationSucceeded) {
          metrics.dispatchedGovernedExecutionRequestCount +=
            dispatchResult.dispatchRecorded ? 1 : 0;
          this.deps.logger.info("governed_execution_request_dispatched", {
            requestId: request.id,
            executionType: request.executionType,
            targetType: request.targetType,
            targetId: request.targetId,
            executionPackageHash:
              dispatchResult.request.executionPackageHash ??
              request.executionPackageHash,
            dispatchReference
          });
        } else {
          metrics.governedExecutionDispatchFailureCount += 1;
          this.deps.logger.error("governed_execution_request_dispatch_failed", {
            requestId: request.id,
            executionType: request.executionType,
            targetType: request.targetType,
            targetId: request.targetId,
            dispatchReference,
            verificationFailureReason:
              dispatchResult.verificationFailureReason
          });
        }
      } catch (error) {
        metrics.governedExecutionDispatchFailureCount += 1;
        this.deps.logger.error("governed_execution_request_dispatch_failed", {
          requestId: request.id,
          executionType: request.executionType,
          targetType: request.targetType,
          targetId: request.targetId,
          error
        });
      }
    }
  }

  private async processDueLoanInstallments(
    installments: Array<{ loanAgreementId: string }>,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    const uniqueAgreementIds = Array.from(
      new Set(installments.map((installment) => installment.loanAgreementId))
    );

    for (const loanAgreementId of uniqueAgreementIds) {
      const result = await this.deps.internalApiClient.runLoanAutopay(loanAgreementId);
      if (!result.attempted) {
        continue;
      }

      metrics.autopayLoanSweepCount += 1;

      if (result.succeeded) {
        metrics.autopayLoanSuccessCount += 1;
      } else {
        metrics.autopayLoanFailureCount += 1;
      }
    }
  }

  private async processLoanValuationRefreshes(
    agreements: Array<{ loanAgreementId: string }>,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const agreement of agreements) {
      await this.deps.internalApiClient.refreshLoanValuation(agreement.loanAgreementId);
      metrics.valuationRefreshCount += 1;
    }
  }

  private async processExpiredGracePeriodLoans(
    agreements: Array<{ loanAgreementId: string }>,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const agreement of agreements) {
      await this.deps.internalApiClient.escalateLoanDefault(agreement.loanAgreementId);
      metrics.defaultEscalatedLoanCount += 1;
    }
  }

  private logQueuedBacklog(
    intentType: "deposit" | "withdrawal",
    result: ListIntentsResult
  ): void {
    if (result.intents.length === 0) {
      return;
    }

    this.deps.logger.warn("queued_execution_pending_external_broadcaster", {
      intentType,
      count: result.intents.length,
      intentIds: stringifyIntentIds(result.intents)
    });
  }

  private async processQueuedDepositsSynthetic(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      const payload: RecordBroadcastPayload = {
        txHash: buildSyntheticTxHash(intent.id, "deposit"),
        fromAddress: SYNTHETIC_TREASURY_ADDRESS,
        toAddress: intent.destinationWalletAddress ?? undefined
      };

      await this.deps.internalApiClient.recordDepositBroadcast(intent.id, payload);
      metrics.depositBroadcastRecordedCount += 1;
      this.deps.logger.info("synthetic_deposit_broadcast_recorded", {
        intentId: intent.id,
        txHash: payload.txHash
      });
    }
  }

  private async processQueuedDepositsManaged(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    if (!this.deps.depositBroadcaster) {
      throw new Error("Managed deposit broadcaster is required in managed mode.");
    }

    for (const intent of result.intents) {
      try {
        const broadcast = await this.deps.depositBroadcaster.broadcast(intent);

        await this.deps.internalApiClient.recordDepositBroadcast(intent.id, {
          txHash: broadcast.txHash,
          fromAddress: broadcast.fromAddress,
          toAddress: broadcast.toAddress
        });
        metrics.depositBroadcastRecordedCount += 1;
        this.deps.logger.info("managed_deposit_broadcast_recorded", {
          intentId: intent.id,
          txHash: broadcast.txHash,
          fromAddress: broadcast.fromAddress,
          toAddress: broadcast.toAddress,
          assetSymbol: intent.asset.symbol,
          requestedAmount: intent.requestedAmount
        });
      } catch (error) {
        if (error instanceof ManagedExecutionIntentError) {
          await this.deps.internalApiClient.failDepositIntent(intent.id, {
            failureCode: error.failure.failureCode,
            failureReason: error.failure.failureReason,
            fromAddress: error.failure.fromAddress,
            toAddress: error.failure.toAddress
          });
          metrics.depositFailedCount += 1;
          this.deps.logger.warn("managed_deposit_execution_failed_permanently", {
            intentId: intent.id,
            failureCode: error.failure.failureCode,
            failureReason: error.failure.failureReason,
            assetSymbol: intent.asset.symbol
          });
          continue;
        }

        this.deps.logger.error("managed_deposit_execution_failed_retryable", {
          intentId: intent.id,
          assetSymbol: intent.asset.symbol,
          requestedAmount: intent.requestedAmount,
          error
        });
      }
    }
  }

  private async processQueuedWithdrawalsSynthetic(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      const payload: RecordBroadcastPayload = {
        txHash: buildSyntheticTxHash(intent.id, "withdrawal"),
        fromAddress: intent.sourceWalletAddress ?? undefined,
        toAddress: intent.externalAddress ?? undefined
      };

      await this.deps.internalApiClient.recordWithdrawalBroadcast(
        intent.id,
        payload
      );
      metrics.withdrawalBroadcastRecordedCount += 1;
      this.deps.logger.info("synthetic_withdrawal_broadcast_recorded", {
        intentId: intent.id,
        txHash: payload.txHash
      });
    }
  }

  private recordManualWithdrawalIntervention(
    intent: WorkerIntentProjection,
    metrics: WorkerIterationMetrics,
    reason: string
  ): void {
    metrics.manualWithdrawalBacklogCount += 1;
    this.deps.logger.warn("managed_withdrawal_requires_manual_intervention", {
      intentId: intent.id,
      assetSymbol: intent.asset.symbol,
      requestedAmount: intent.requestedAmount,
      sourceWalletAddress: intent.sourceWalletAddress,
      externalAddress: intent.externalAddress,
      reason
    });
  }

  private async recordManagedWithdrawalBroadcast(
    intent: WorkerIntentProjection,
    preparedTransaction: PreparedManagedWithdrawalTransaction,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    await this.deps.internalApiClient.recordWithdrawalBroadcast(intent.id, {
      txHash: preparedTransaction.txHash,
      fromAddress: preparedTransaction.fromAddress,
      toAddress: preparedTransaction.toAddress
    });
    metrics.withdrawalBroadcastRecordedCount += 1;
    this.deps.logger.info("managed_withdrawal_broadcast_recorded", {
      intentId: intent.id,
      txHash: preparedTransaction.txHash,
      fromAddress: preparedTransaction.fromAddress,
      toAddress: preparedTransaction.toAddress,
      assetSymbol: intent.asset.symbol,
      requestedAmount: intent.requestedAmount
    });
  }

  private async processQueuedWithdrawalsManaged(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      if (
        intent.executionFailureCategory === "manual_intervention_required" ||
        intent.manualInterventionRequiredAt
      ) {
        metrics.manualWithdrawalBacklogCount += 1;
        continue;
      }

      if (intent.sourceWalletCustodyType === "platform_managed") {
        await this.processPlatformManagedQueuedWithdrawal(intent, metrics);
        continue;
      }

      if (intent.sourceWalletCustodyType === "contract_controlled") {
        await this.processPolicyControlledQueuedWithdrawal(intent, metrics);
        continue;
      }

      this.recordManualWithdrawalIntervention(
        intent,
        metrics,
        "Withdrawal source wallet custody type is not configured for automated execution."
      );
    }
  }

  private async processPlatformManagedQueuedWithdrawal(
    intent: WorkerIntentProjection,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    if (!this.deps.withdrawalBroadcaster) {
      throw new Error(
        "Managed withdrawal broadcaster is required in managed mode."
      );
    }

    if (!this.deps.withdrawalBroadcaster.canManageWallet(intent.sourceWalletAddress)) {
      await this.deps.internalApiClient.failWithdrawalIntent(intent.id, {
        failureCode: "managed_withdrawal_signer_unavailable",
        failureReason:
          "No managed signer is configured for the withdrawal source wallet.",
        failureCategory: "manual_intervention_required"
      });
      metrics.manualWithdrawalBacklogCount += 1;
      return;
    }

    await this.processQueuedWithdrawalWithBroadcaster({
      intent,
      metrics,
      broadcaster: this.deps.withdrawalBroadcaster,
      invalidSignedStateFailureCode: "managed_signed_withdrawal_state_invalid",
      invalidSignedStateFailureReason:
        "Signed withdrawal execution state is missing durable transaction payload data.",
      manualFailureCodes: new Set(["managed_withdrawal_signer_unavailable"]),
      permanentFailureLogEvent: "managed_withdrawal_execution_failed_permanently",
      retryableFailureLogEvent: "managed_withdrawal_execution_failed_retryable"
    });
  }

  private async processPolicyControlledQueuedWithdrawal(
    intent: WorkerIntentProjection,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    if (!this.deps.policyControlledWithdrawalBroadcaster) {
      await this.deps.internalApiClient.failWithdrawalIntent(intent.id, {
        failureCode: "policy_controlled_withdrawal_runtime_unconfigured",
        failureReason:
          "Policy-controlled withdrawal execution is not configured in this worker runtime.",
        failureCategory: "manual_intervention_required"
      });
      metrics.manualWithdrawalBacklogCount += 1;
      return;
    }

    await this.processQueuedWithdrawalWithBroadcaster({
      intent,
      metrics,
      broadcaster: this.deps.policyControlledWithdrawalBroadcaster,
      invalidSignedStateFailureCode:
        "policy_controlled_signed_withdrawal_state_invalid",
      invalidSignedStateFailureReason:
        "Signed policy-controlled withdrawal execution state is missing durable transaction payload data.",
      manualFailureCodes: new Set([
        "policy_controlled_wallet_policy_signer_mismatch",
        "policy_controlled_wallet_executor_mismatch"
      ]),
      permanentFailureLogEvent:
        "policy_controlled_withdrawal_execution_failed_permanently",
      retryableFailureLogEvent:
        "policy_controlled_withdrawal_execution_failed_retryable"
    });
  }

  private async processQueuedWithdrawalWithBroadcaster(args: {
    intent: WorkerIntentProjection;
    metrics: WorkerIterationMetrics;
    broadcaster: {
      prepare(
        intent: WorkerIntentProjection
      ): Promise<PreparedManagedWithdrawalTransaction>;
      broadcastSignedTransaction(
        signedTransaction: string
      ): Promise<{ txHash: string }>;
    };
    invalidSignedStateFailureCode: string;
    invalidSignedStateFailureReason: string;
    manualFailureCodes: Set<string>;
    permanentFailureLogEvent: string;
    retryableFailureLogEvent: string;
  }): Promise<void> {
    try {
      const latestBlockchainTransaction =
        args.intent.latestBlockchainTransaction;

      if (
        latestBlockchainTransaction?.status === "signed" &&
        latestBlockchainTransaction.serializedTransaction &&
        latestBlockchainTransaction.txHash &&
        latestBlockchainTransaction.fromAddress &&
        latestBlockchainTransaction.toAddress
      ) {
        args.metrics.signedWithdrawalCount += 1;
        await args.broadcaster.broadcastSignedTransaction(
          latestBlockchainTransaction.serializedTransaction
        );
        await this.recordManagedWithdrawalBroadcast(
          args.intent,
          {
            txHash: latestBlockchainTransaction.txHash,
            nonce: latestBlockchainTransaction.nonce ?? 0,
            serializedTransaction:
              latestBlockchainTransaction.serializedTransaction,
            fromAddress: latestBlockchainTransaction.fromAddress,
            toAddress: latestBlockchainTransaction.toAddress
          },
          args.metrics
        );
        return;
      }

      if (
        latestBlockchainTransaction?.status === "signed" &&
        (!latestBlockchainTransaction.serializedTransaction ||
          !latestBlockchainTransaction.txHash)
      ) {
        await this.deps.internalApiClient.failWithdrawalIntent(args.intent.id, {
          failureCode: args.invalidSignedStateFailureCode,
          failureReason: args.invalidSignedStateFailureReason,
          failureCategory: "permanent",
          txHash: latestBlockchainTransaction.txHash ?? undefined,
          fromAddress: latestBlockchainTransaction.fromAddress ?? undefined,
          toAddress: latestBlockchainTransaction.toAddress ?? undefined
        });
        args.metrics.withdrawalFailedCount += 1;
        return;
      }

      const execution = await this.deps.internalApiClient.startManagedWithdrawalExecution(
        args.intent.id,
        {
          reclaimStaleAfterMs:
            this.deps.runtime.managedWithdrawalClaimTimeoutMs
        }
      );

      if (!execution.executionClaimed) {
        return;
      }

      const claimedIntent = execution.intent;
      const claimedLatestBlockchainTransaction =
        claimedIntent.latestBlockchainTransaction;

      if (
        claimedLatestBlockchainTransaction?.status === "signed" &&
        claimedLatestBlockchainTransaction.serializedTransaction &&
        claimedLatestBlockchainTransaction.txHash &&
        claimedLatestBlockchainTransaction.fromAddress &&
        claimedLatestBlockchainTransaction.toAddress
      ) {
        args.metrics.signedWithdrawalCount += 1;
        await args.broadcaster.broadcastSignedTransaction(
          claimedLatestBlockchainTransaction.serializedTransaction
        );
        await this.recordManagedWithdrawalBroadcast(
          claimedIntent,
          {
            txHash: claimedLatestBlockchainTransaction.txHash,
            nonce: claimedLatestBlockchainTransaction.nonce ?? 0,
            serializedTransaction:
              claimedLatestBlockchainTransaction.serializedTransaction,
            fromAddress: claimedLatestBlockchainTransaction.fromAddress,
            toAddress: claimedLatestBlockchainTransaction.toAddress
          },
          args.metrics
        );
        return;
      }

      if (
        claimedLatestBlockchainTransaction?.status === "signed" &&
        (!claimedLatestBlockchainTransaction.serializedTransaction ||
          !claimedLatestBlockchainTransaction.txHash)
      ) {
        await this.deps.internalApiClient.failWithdrawalIntent(claimedIntent.id, {
          failureCode: args.invalidSignedStateFailureCode,
          failureReason: args.invalidSignedStateFailureReason,
          failureCategory: "permanent",
          txHash: claimedLatestBlockchainTransaction.txHash ?? undefined,
          fromAddress:
            claimedLatestBlockchainTransaction.fromAddress ?? undefined,
          toAddress: claimedLatestBlockchainTransaction.toAddress ?? undefined
        });
        args.metrics.withdrawalFailedCount += 1;
        return;
      }

      const preparedTransaction = await args.broadcaster.prepare(claimedIntent);

      await this.deps.internalApiClient.recordSignedWithdrawalExecution(
        claimedIntent.id,
        {
          txHash: preparedTransaction.txHash,
          nonce: preparedTransaction.nonce,
          serializedTransaction: preparedTransaction.serializedTransaction,
          fromAddress: preparedTransaction.fromAddress,
          toAddress: preparedTransaction.toAddress
        }
      );

      await args.broadcaster.broadcastSignedTransaction(
        preparedTransaction.serializedTransaction
      );
      await this.recordManagedWithdrawalBroadcast(
        claimedIntent,
        preparedTransaction,
        args.metrics
      );
    } catch (error) {
      if (error instanceof ManagedExecutionIntentError) {
        if (args.manualFailureCodes.has(error.failure.failureCode)) {
          await this.deps.internalApiClient.failWithdrawalIntent(args.intent.id, {
            failureCode: error.failure.failureCode,
            failureReason: error.failure.failureReason,
            failureCategory: "manual_intervention_required",
            fromAddress: error.failure.fromAddress,
            toAddress: error.failure.toAddress
          });
          args.metrics.manualWithdrawalBacklogCount += 1;
          return;
        }

        await this.deps.internalApiClient.failWithdrawalIntent(args.intent.id, {
          failureCode: error.failure.failureCode,
          failureReason: error.failure.failureReason,
          failureCategory: "permanent",
          fromAddress: error.failure.fromAddress,
          toAddress: error.failure.toAddress
        });
        args.metrics.withdrawalFailedCount += 1;
        this.deps.logger.warn(args.permanentFailureLogEvent, {
          intentId: args.intent.id,
          failureCode: error.failure.failureCode,
          failureReason: error.failure.failureReason,
          assetSymbol: args.intent.asset.symbol
        });
        return;
      }

      this.deps.logger.error(args.retryableFailureLogEvent, {
        intentId: args.intent.id,
        assetSymbol: args.intent.asset.symbol,
        requestedAmount: args.intent.requestedAmount,
        error
      });
      await this.deps.internalApiClient.failWithdrawalIntent(args.intent.id, {
        failureCode: "managed_withdrawal_retryable_error",
        failureReason:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Managed withdrawal execution encountered a retryable runtime error.",
        failureCategory: "retryable"
      });
      args.metrics.retryableWithdrawalFailureCount += 1;
    }
  }

  private async processBroadcastDepositsSynthetic(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      const txHash = intent.latestBlockchainTransaction?.txHash ?? undefined;

      await this.deps.internalApiClient.confirmDepositIntent(intent.id, {
        txHash
      });
      metrics.depositConfirmedCount += 1;
      await this.deps.internalApiClient.settleDepositIntent(intent.id, {
        note: "Settled by synthetic worker runtime."
      });
      metrics.depositSettledCount += 1;
      this.deps.logger.info("synthetic_deposit_settled", {
        intentId: intent.id,
        txHash
      });
    }
  }

  private async processBroadcastWithdrawalsSynthetic(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      const txHash = intent.latestBlockchainTransaction?.txHash ?? undefined;

      await this.deps.internalApiClient.confirmWithdrawalIntent(intent.id, {
        txHash
      });
      metrics.withdrawalConfirmedCount += 1;
      await this.deps.internalApiClient.settleWithdrawalIntent(intent.id, {
        note: "Settled by synthetic worker runtime."
      });
      metrics.withdrawalSettledCount += 1;
      this.deps.logger.info("synthetic_withdrawal_settled", {
        intentId: intent.id,
        txHash
      });
    }
  }

  private async processBroadcastDepositsMonitor(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      await this.advanceBroadcastIntent({
        intentType: "deposit",
        intent,
        metrics,
        failIntent: (intentId, payload) =>
          this.deps.internalApiClient.failDepositIntent(intentId, payload),
        confirmIntent: (intentId, payload) =>
          this.deps.internalApiClient.confirmDepositIntent(intentId, payload),
        settleIntent: (intentId, payload) =>
          this.deps.internalApiClient.settleDepositIntent(intentId, payload)
      });
    }
  }

  private async processBroadcastWithdrawalsMonitor(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      await this.advanceBroadcastIntent({
        intentType: "withdrawal",
        intent,
        metrics,
        failIntent: (intentId, payload) =>
          this.deps.internalApiClient.failWithdrawalIntent(intentId, payload),
        confirmIntent: (intentId, payload) =>
          this.deps.internalApiClient.confirmWithdrawalIntent(intentId, payload),
        settleIntent: (intentId, payload) =>
          this.deps.internalApiClient.settleWithdrawalIntent(intentId, payload)
      });
    }
  }

  private async processConfirmedDepositsReadyToSettle(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      await this.deps.internalApiClient.settleDepositIntent(intent.id, {
        note:
          "Recovered settlement from confirmed backlog after prior confirmation succeeded."
      });
      metrics.depositSettledCount += 1;
      this.deps.logger.info("confirmed_intent_settled_from_recovery_backlog", {
        intentType: "deposit",
        intentId: intent.id,
        assetSymbol: intent.asset.symbol,
        requestedAmount: intent.requestedAmount,
        txHash: intent.latestBlockchainTransaction?.txHash ?? null
      });
    }
  }

  private async processConfirmedWithdrawalsReadyToSettle(
    result: ListIntentsResult,
    metrics: WorkerIterationMetrics
  ): Promise<void> {
    for (const intent of result.intents) {
      await this.deps.internalApiClient.settleWithdrawalIntent(intent.id, {
        note:
          "Recovered settlement from confirmed backlog after prior confirmation succeeded."
      });
      metrics.withdrawalSettledCount += 1;
      this.deps.logger.info("confirmed_intent_settled_from_recovery_backlog", {
        intentType: "withdrawal",
        intentId: intent.id,
        assetSymbol: intent.asset.symbol,
        requestedAmount: intent.requestedAmount,
        txHash: intent.latestBlockchainTransaction?.txHash ?? null
      });
    }
  }

  private async advanceBroadcastIntent(args: {
    intentType: "deposit" | "withdrawal";
    intent: WorkerIntentProjection;
    metrics: WorkerIterationMetrics;
    failIntent: (
      intentId: string,
      payload: {
        failureCode: string;
        failureReason: string;
        txHash?: string;
        fromAddress?: string;
        toAddress?: string;
      }
    ) => Promise<void>;
    confirmIntent: (
      intentId: string,
      payload: { txHash?: string }
    ) => Promise<void>;
    settleIntent: (
      intentId: string,
      payload: { note?: string }
    ) => Promise<void>;
  }): Promise<void> {
    const txHash = args.intent.latestBlockchainTransaction?.txHash;

    if (!txHash) {
      this.deps.logger.warn("broadcast_intent_missing_tx_hash", {
        intentType: args.intentType,
        intentId: args.intent.id
      });
      return;
    }

    if (!this.deps.rpcClient) {
      throw new Error("RPC client is required for monitor mode.");
    }

    const receipt = await this.deps.rpcClient.getTransactionReceipt(txHash);

    if (!receipt) {
      this.deps.logger.info("broadcast_intent_pending_confirmation", {
        intentType: args.intentType,
        intentId: args.intent.id,
        txHash
      });
      return;
    }

    if (!receipt.succeeded) {
      await args.failIntent(args.intent.id, {
        failureCode: "onchain_reverted",
        failureReason: "Transaction reverted on chain.",
        txHash,
        fromAddress: receipt.fromAddress ?? undefined,
        toAddress: receipt.toAddress ?? undefined
      });
      if (args.intentType === "deposit") {
        args.metrics.depositFailedCount += 1;
      } else {
        args.metrics.withdrawalFailedCount += 1;
      }
      this.deps.logger.warn("broadcast_intent_marked_failed", {
        intentType: args.intentType,
        intentId: args.intent.id,
        txHash
      });
      return;
    }

    const latestBlockNumber = await this.deps.rpcClient.getBlockNumber();
    const confirmations = latestBlockNumber - receipt.blockNumber + 1n;

    if (confirmations < BigInt(this.deps.runtime.confirmationBlocks)) {
      this.deps.logger.info("broadcast_intent_waiting_confirmations", {
        intentType: args.intentType,
        intentId: args.intent.id,
        txHash,
        confirmations: confirmations.toString(),
        requiredConfirmations: this.deps.runtime.confirmationBlocks
      });
      return;
    }

    await args.confirmIntent(args.intent.id, { txHash });
    if (args.intentType === "deposit") {
      args.metrics.depositConfirmedCount += 1;
    } else {
      args.metrics.withdrawalConfirmedCount += 1;
    }
    await args.settleIntent(args.intent.id, {
      note: `Settled by worker after ${confirmations.toString()} confirmations.`
    });
    if (args.intentType === "deposit") {
      args.metrics.depositSettledCount += 1;
    } else {
      args.metrics.withdrawalSettledCount += 1;
    }

    this.deps.logger.info("broadcast_intent_confirmed_and_settled", {
      intentType: args.intentType,
      intentId: args.intent.id,
      txHash,
      confirmations: confirmations.toString()
    });
  }
}
