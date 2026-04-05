import { createHash } from "node:crypto";
import { ManagedExecutionIntentError } from "./deposit-broadcaster";
import type { InternalWorkerApiClient } from "./internal-worker-api-client";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  BroadcastReceipt,
  ManagedDepositBroadcaster,
  ListIntentsResult,
  RecordBroadcastPayload,
  WorkerIntentProjection,
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

export class WorkerOrchestrator {
  constructor(private readonly deps: WorkerOrchestratorDeps) {}

  async runOnce(): Promise<void> {
    const queuedDeposits = await this.deps.internalApiClient.listQueuedDepositIntents(
      this.deps.runtime.batchLimit
    );
    const queuedWithdrawals =
      await this.deps.internalApiClient.listQueuedWithdrawalIntents(
        this.deps.runtime.batchLimit
      );

    if (this.deps.runtime.executionMode === "synthetic") {
      await this.processQueuedDepositsSynthetic(queuedDeposits);
      await this.processQueuedWithdrawalsSynthetic(queuedWithdrawals);
    } else if (this.deps.runtime.executionMode === "managed") {
      await this.processQueuedDepositsManaged(queuedDeposits);
      this.logQueuedWithdrawalsRequiringManualExecution(queuedWithdrawals);
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

    if (this.deps.runtime.executionMode === "synthetic") {
      await this.processBroadcastDepositsSynthetic(broadcastDeposits);
      await this.processBroadcastWithdrawalsSynthetic(broadcastWithdrawals);
      return;
    }

    await this.processBroadcastDepositsMonitor(broadcastDeposits);
    await this.processBroadcastWithdrawalsMonitor(broadcastWithdrawals);
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
    result: ListIntentsResult
  ): Promise<void> {
    for (const intent of result.intents) {
      const payload: RecordBroadcastPayload = {
        txHash: buildSyntheticTxHash(intent.id, "deposit"),
        fromAddress: SYNTHETIC_TREASURY_ADDRESS,
        toAddress: intent.destinationWalletAddress ?? undefined
      };

      await this.deps.internalApiClient.recordDepositBroadcast(intent.id, payload);
      this.deps.logger.info("synthetic_deposit_broadcast_recorded", {
        intentId: intent.id,
        txHash: payload.txHash
      });
    }
  }

  private async processQueuedDepositsManaged(
    result: ListIntentsResult
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
    result: ListIntentsResult
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
      this.deps.logger.info("synthetic_withdrawal_broadcast_recorded", {
        intentId: intent.id,
        txHash: payload.txHash
      });
    }
  }

  private logQueuedWithdrawalsRequiringManualExecution(
    result: ListIntentsResult
  ): void {
    if (result.intents.length === 0) {
      return;
    }

    this.deps.logger.warn("queued_withdrawals_require_manual_custody_execution", {
      count: result.intents.length,
      intentIds: stringifyIntentIds(result.intents),
      reason:
        "Customer withdrawal intents originate from product wallet projections that do not have an automated worker signer."
    });
  }

  private async processBroadcastDepositsSynthetic(
    result: ListIntentsResult
  ): Promise<void> {
    for (const intent of result.intents) {
      const txHash = intent.latestBlockchainTransaction?.txHash ?? undefined;

      await this.deps.internalApiClient.confirmDepositIntent(intent.id, {
        txHash
      });
      await this.deps.internalApiClient.settleDepositIntent(intent.id, {
        note: "Settled by synthetic worker runtime."
      });
      this.deps.logger.info("synthetic_deposit_settled", {
        intentId: intent.id,
        txHash
      });
    }
  }

  private async processBroadcastWithdrawalsSynthetic(
    result: ListIntentsResult
  ): Promise<void> {
    for (const intent of result.intents) {
      const txHash = intent.latestBlockchainTransaction?.txHash ?? undefined;

      await this.deps.internalApiClient.confirmWithdrawalIntent(intent.id, {
        txHash
      });
      await this.deps.internalApiClient.settleWithdrawalIntent(intent.id, {
        note: "Settled by synthetic worker runtime."
      });
      this.deps.logger.info("synthetic_withdrawal_settled", {
        intentId: intent.id,
        txHash
      });
    }
  }

  private async processBroadcastDepositsMonitor(
    result: ListIntentsResult
  ): Promise<void> {
    for (const intent of result.intents) {
      await this.advanceBroadcastIntent({
        intentType: "deposit",
        intent,
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
    result: ListIntentsResult
  ): Promise<void> {
    for (const intent of result.intents) {
      await this.advanceBroadcastIntent({
        intentType: "withdrawal",
        intent,
        failIntent: (intentId, payload) =>
          this.deps.internalApiClient.failWithdrawalIntent(intentId, payload),
        confirmIntent: (intentId, payload) =>
          this.deps.internalApiClient.confirmWithdrawalIntent(intentId, payload),
        settleIntent: (intentId, payload) =>
          this.deps.internalApiClient.settleWithdrawalIntent(intentId, payload)
      });
    }
  }

  private async advanceBroadcastIntent(args: {
    intentType: "deposit" | "withdrawal";
    intent: WorkerIntentProjection;
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
    await args.settleIntent(args.intent.id, {
      note: `Settled by worker after ${confirmations.toString()} confirmations.`
    });

    this.deps.logger.info("broadcast_intent_confirmed_and_settled", {
      intentType: args.intentType,
      intentId: args.intent.id,
      txHash,
      confirmations: confirmations.toString()
    });
  }
}
