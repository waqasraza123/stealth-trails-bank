import { findWorkspaceBoundary } from "@stealth-trails-bank/config";
import type { WorkspaceBoundary } from "@stealth-trails-bank/types";
import {
  createInternalWorkerApiClient,
  InternalApiUnavailableError
} from "./runtime/internal-worker-api-client";
import {
  createInternalApiStartupAvailabilityState,
  reportInternalApiStartupAvailable,
  reportInternalApiStartupUnavailable
} from "./runtime/internal-api-startup-guard";
import { createManagedDepositBroadcaster } from "./runtime/deposit-broadcaster";
import { createJsonRpcClient } from "./runtime/json-rpc-client";
import { createPolicyControlledWithdrawalBroadcaster } from "./runtime/policy-controlled-withdrawal-broadcaster";
import { createManagedWithdrawalBroadcaster } from "./runtime/withdrawal-broadcaster";
import { createWorkerLogger } from "./runtime/worker-logger";
import { WorkerOrchestrator } from "./runtime/worker-orchestrator";
import { loadWorkerRuntime } from "./runtime/worker-runtime";
import type {
  TrackedLedgerReconciliationScanResult,
  WorkerHeartbeatPayload,
  WorkerIterationMetrics
} from "./runtime/worker-types";

function requireWorkerWorkspaceBoundary(): WorkspaceBoundary {
  const workspaceBoundary = findWorkspaceBoundary("worker");

  if (!workspaceBoundary) {
    throw new Error("Worker workspace boundary is not configured.");
  }

  return workspaceBoundary;
}

export const workerWorkspaceBoundary = requireWorkerWorkspaceBoundary();

export function getWorkerWorkspaceBoundary(): WorkspaceBoundary {
  return workerWorkspaceBoundary;
}

function normalizeWorkerError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof InternalApiUnavailableError) {
    return {
      code: error.code ?? "internal_api_unavailable",
      message: error.message
    };
  }

  if (error instanceof Error) {
    return {
      code: error.name || "worker_iteration_failed",
      message: error.message
    };
  }

  return {
    code: "worker_iteration_failed",
    message: "Worker iteration failed."
  };
}

async function safeReportWorkerHeartbeat(args: {
  internalApiClient: ReturnType<typeof createInternalWorkerApiClient>;
  logger: ReturnType<typeof createWorkerLogger>;
  payload: WorkerHeartbeatPayload;
}): Promise<InternalApiUnavailableError | null> {
  try {
    await args.internalApiClient.reportWorkerHeartbeat(args.payload);
    return null;
  } catch (error) {
    if (error instanceof InternalApiUnavailableError) {
      return error;
    }

    args.logger.error("worker_heartbeat_report_failed", {
      error
    });
    return null;
  }
}

export async function startWorkerRuntime(): Promise<void> {
  const runtime = loadWorkerRuntime();
  const logger = createWorkerLogger(runtime);
  const internalApiClient = createInternalWorkerApiClient(runtime);
  const rpcClient = runtime.rpcUrl
    ? createJsonRpcClient(runtime.rpcUrl, runtime.requestTimeoutMs)
    : null;
  const depositBroadcaster =
    runtime.executionMode === "managed"
      ? createManagedDepositBroadcaster(runtime)
      : null;
  const withdrawalBroadcaster =
    runtime.executionMode === "managed"
      ? createManagedWithdrawalBroadcaster(runtime)
      : null;
  const policyControlledWithdrawalBroadcaster =
    runtime.executionMode === "managed"
      ? createPolicyControlledWithdrawalBroadcaster(runtime)
      : null;
  const orchestrator = new WorkerOrchestrator({
    runtime,
    internalApiClient,
    rpcClient,
    depositBroadcaster,
    withdrawalBroadcaster,
    policyControlledWithdrawalBroadcaster,
    logger
  });
  const internalApiStartupState = createInternalApiStartupAvailabilityState();
  const workerStartedAtMs = Date.now();

  let shutdownRequested = false;
  let lastReconciliationScanAttemptedAt = 0;
  let lastPlatformAlertReEscalationAttemptedAt = 0;
  let lastSolvencySnapshotAttemptedAt = 0;
  let lastReconciliationScanResult: TrackedLedgerReconciliationScanResult | null =
    null;
  let lastReconciliationScanFailure: {
    startedAt: string;
    completedAt: string;
    errorCode: string;
    errorMessage: string;
  } | null = null;

  const requestShutdown = (signal: string) => {
    if (shutdownRequested) {
      return;
    }

    shutdownRequested = true;
    logger.info("worker_shutdown_requested", {
      signal
    });
  };

  process.once("SIGINT", () => {
    requestShutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    requestShutdown("SIGTERM");
  });

  logger.info("worker_started", {
    executionMode: runtime.executionMode,
    batchLimit: runtime.batchLimit,
    pollIntervalMs: runtime.pollIntervalMs,
    confirmationBlocks: runtime.confirmationBlocks,
    internalApiStartupGracePeriodMs: runtime.internalApiStartupGracePeriodMs
  });

  while (!shutdownRequested) {
    const iterationStartedAt = new Date();

    const initialHeartbeatUnavailableError = await safeReportWorkerHeartbeat({
      internalApiClient,
      logger,
      payload: {
        environment: runtime.environment,
        executionMode: runtime.executionMode,
        lastIterationStatus: "running",
        lastIterationStartedAt: iterationStartedAt.toISOString(),
        lastReconciliationScanRunId: lastReconciliationScanResult?.scanRun.id,
        lastReconciliationScanStartedAt:
          lastReconciliationScanFailure?.startedAt ??
          lastReconciliationScanResult?.scanRun.startedAt,
        lastReconciliationScanCompletedAt:
          lastReconciliationScanFailure?.completedAt ??
          lastReconciliationScanResult?.scanRun.completedAt ??
          undefined,
        lastReconciliationScanStatus:
          (lastReconciliationScanFailure
            ? "failed"
            : lastReconciliationScanResult?.scanRun.status) as
            | "running"
            | "succeeded"
            | "failed"
            | undefined,
        runtimeMetadata: {
          pollIntervalMs: runtime.pollIntervalMs,
          batchLimit: runtime.batchLimit,
          internalApiStartupGracePeriodMs:
            runtime.internalApiStartupGracePeriodMs,
          confirmationBlocks: runtime.confirmationBlocks,
          reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs,
          solvencySnapshotIntervalMs: runtime.solvencySnapshotIntervalMs,
          platformAlertReEscalationIntervalMs:
            runtime.platformAlertReEscalationIntervalMs,
          policyControlledWithdrawalReady: Boolean(
            runtime.policyControlledWithdrawalExecutorPrivateKey &&
              runtime.policyControlledWithdrawalPolicySignerPrivateKey
          )
        }
      }
    });

    if (initialHeartbeatUnavailableError) {
      const handledAsStartupWait = reportInternalApiStartupUnavailable({
        logger,
        error: initialHeartbeatUnavailableError,
        state: internalApiStartupState,
        workerStartedAtMs,
        startupGracePeriodMs: runtime.internalApiStartupGracePeriodMs
      });

      if (!handledAsStartupWait) {
        logger.warn("worker_heartbeat_report_retryable_failure", {
          baseUrl: initialHeartbeatUnavailableError.baseUrl,
          errorCode: initialHeartbeatUnavailableError.code,
          message: initialHeartbeatUnavailableError.message
        });
      }
    } else {
      reportInternalApiStartupAvailable({
        logger,
        state: internalApiStartupState,
        baseUrl: runtime.internalApiBaseUrl
      });
    }

    let iterationMetrics: WorkerIterationMetrics | null = null;

    try {
      iterationMetrics = await orchestrator.runOnce();
      reportInternalApiStartupAvailable({
        logger,
        state: internalApiStartupState,
        baseUrl: runtime.internalApiBaseUrl
      });

      const now = Date.now();
      if (now - lastReconciliationScanAttemptedAt >= runtime.reconciliationScanIntervalMs) {
        lastReconciliationScanAttemptedAt = now;
        const reconciliationScanStartedAt = new Date();
        lastReconciliationScanFailure = null;

        try {
          const scanResult = await internalApiClient.triggerLedgerReconciliationScan({});
          lastReconciliationScanResult = scanResult;
          logger.info("scheduled_ledger_reconciliation_scan_completed", {
            scanRunId: scanResult.scanRun.id,
            status: scanResult.scanRun.status,
            activeMismatchCount: scanResult.result.activeMismatchCount,
            createdCount: scanResult.result.createdCount,
            reopenedCount: scanResult.result.reopenedCount,
            autoResolvedCount: scanResult.result.autoResolvedCount
          });
        } catch (error) {
          const normalizedError = normalizeWorkerError(error);
          lastReconciliationScanFailure = {
            startedAt: reconciliationScanStartedAt.toISOString(),
            completedAt: new Date().toISOString(),
            errorCode: normalizedError.code,
            errorMessage: normalizedError.message
          };
          logger.error("scheduled_ledger_reconciliation_scan_failed", {
            error
          });
        }
      }

      if (now - lastSolvencySnapshotAttemptedAt >= runtime.solvencySnapshotIntervalMs) {
        lastSolvencySnapshotAttemptedAt = now;

        try {
          const solvencySnapshotResult =
            await internalApiClient.triggerSolvencySnapshot();
          logger.info("scheduled_solvency_snapshot_completed", {
            snapshotId: solvencySnapshotResult.snapshot.id,
            status: solvencySnapshotResult.snapshot.status,
            evidenceFreshness: solvencySnapshotResult.snapshot.evidenceFreshness,
            issueCount: solvencySnapshotResult.issueCount,
            criticalIssueCount: solvencySnapshotResult.criticalIssueCount,
            policyStatus: solvencySnapshotResult.policyState.status
          });
        } catch (error) {
          logger.error("scheduled_solvency_snapshot_failed", {
            error
          });
        }
      }

      if (
        now - lastPlatformAlertReEscalationAttemptedAt >=
        runtime.platformAlertReEscalationIntervalMs
      ) {
        lastPlatformAlertReEscalationAttemptedAt = now;

        try {
          const reEscalationResult =
            await internalApiClient.triggerCriticalAlertReEscalationSweep({});
          iterationMetrics.reEscalatedCriticalAlertCount =
            reEscalationResult.reEscalatedAlertCount;
          logger.info("scheduled_platform_alert_reescalation_completed", {
            evaluatedAlertCount: reEscalationResult.evaluatedAlertCount,
            reEscalatedAlertCount: reEscalationResult.reEscalatedAlertCount,
            skippedPendingDeliveryCount:
              reEscalationResult.skippedPendingDeliveryCount,
            remainingDueAlertCount: reEscalationResult.remainingDueAlertCount
          });
        } catch (error) {
          logger.error("scheduled_platform_alert_reescalation_failed", {
            error
          });
        }
      }

      const iterationCompletedAt = new Date();

      const finalHeartbeatUnavailableError = await safeReportWorkerHeartbeat({
        internalApiClient,
        logger,
        payload: {
          environment: runtime.environment,
          executionMode: runtime.executionMode,
          lastIterationStatus: "succeeded",
          lastIterationStartedAt: iterationStartedAt.toISOString(),
          lastIterationCompletedAt: iterationCompletedAt.toISOString(),
          lastReconciliationScanRunId: lastReconciliationScanResult?.scanRun.id,
          lastReconciliationScanStartedAt:
            lastReconciliationScanFailure?.startedAt ??
            lastReconciliationScanResult?.scanRun.startedAt,
          lastReconciliationScanCompletedAt:
            lastReconciliationScanFailure?.completedAt ??
            lastReconciliationScanResult?.scanRun.completedAt ??
            undefined,
          lastReconciliationScanStatus:
            (lastReconciliationScanFailure
              ? "failed"
              : lastReconciliationScanResult?.scanRun.status) as
              | "running"
              | "succeeded"
              | "failed"
              | undefined,
          runtimeMetadata: {
            pollIntervalMs: runtime.pollIntervalMs,
            batchLimit: runtime.batchLimit,
            internalApiStartupGracePeriodMs:
              runtime.internalApiStartupGracePeriodMs,
            confirmationBlocks: runtime.confirmationBlocks,
            reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs,
            solvencySnapshotIntervalMs: runtime.solvencySnapshotIntervalMs,
            platformAlertReEscalationIntervalMs:
              runtime.platformAlertReEscalationIntervalMs,
            policyControlledWithdrawalReady: Boolean(
              runtime.policyControlledWithdrawalExecutorPrivateKey &&
                runtime.policyControlledWithdrawalPolicySignerPrivateKey
            )
          },
          latestIterationMetrics: iterationMetrics,
          lastIterationDurationMs:
            iterationCompletedAt.getTime() - iterationStartedAt.getTime()
        }
      });

      if (finalHeartbeatUnavailableError) {
        const handledAsStartupWait = reportInternalApiStartupUnavailable({
          logger,
          error: finalHeartbeatUnavailableError,
          state: internalApiStartupState,
          workerStartedAtMs,
          startupGracePeriodMs: runtime.internalApiStartupGracePeriodMs
        });

        if (!handledAsStartupWait) {
          logger.warn("worker_heartbeat_report_retryable_failure", {
            baseUrl: finalHeartbeatUnavailableError.baseUrl,
            errorCode: finalHeartbeatUnavailableError.code,
            message: finalHeartbeatUnavailableError.message
          });
        }
      } else {
        reportInternalApiStartupAvailable({
          logger,
          state: internalApiStartupState,
          baseUrl: runtime.internalApiBaseUrl
        });
      }
    } catch (error) {
      const normalizedError = normalizeWorkerError(error);

      const failedHeartbeatUnavailableError = await safeReportWorkerHeartbeat({
        internalApiClient,
        logger,
        payload: {
          environment: runtime.environment,
          executionMode: runtime.executionMode,
          lastIterationStatus: "failed",
          lastIterationStartedAt: iterationStartedAt.toISOString(),
          lastIterationCompletedAt: new Date().toISOString(),
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
          lastReconciliationScanRunId: lastReconciliationScanResult?.scanRun.id,
          lastReconciliationScanStartedAt:
            lastReconciliationScanFailure?.startedAt ??
            lastReconciliationScanResult?.scanRun.startedAt,
          lastReconciliationScanCompletedAt:
            lastReconciliationScanFailure?.completedAt ??
            lastReconciliationScanResult?.scanRun.completedAt ??
            undefined,
          lastReconciliationScanStatus:
            (lastReconciliationScanFailure
              ? "failed"
              : lastReconciliationScanResult?.scanRun.status) as
              | "running"
              | "succeeded"
              | "failed"
              | undefined,
          runtimeMetadata: {
            pollIntervalMs: runtime.pollIntervalMs,
            batchLimit: runtime.batchLimit,
            internalApiStartupGracePeriodMs:
              runtime.internalApiStartupGracePeriodMs,
            confirmationBlocks: runtime.confirmationBlocks,
            reconciliationScanIntervalMs: runtime.reconciliationScanIntervalMs,
            solvencySnapshotIntervalMs: runtime.solvencySnapshotIntervalMs,
            platformAlertReEscalationIntervalMs:
              runtime.platformAlertReEscalationIntervalMs,
            policyControlledWithdrawalReady: Boolean(
              runtime.policyControlledWithdrawalExecutorPrivateKey &&
                runtime.policyControlledWithdrawalPolicySignerPrivateKey
            )
          },
          latestIterationMetrics: iterationMetrics ?? undefined,
          lastIterationDurationMs: Date.now() - iterationStartedAt.getTime()
        }
      });

      if (failedHeartbeatUnavailableError) {
        const handledAsStartupWait = reportInternalApiStartupUnavailable({
          logger,
          error: failedHeartbeatUnavailableError,
          state: internalApiStartupState,
          workerStartedAtMs,
          startupGracePeriodMs: runtime.internalApiStartupGracePeriodMs
        });

        if (!handledAsStartupWait) {
          logger.warn("worker_heartbeat_report_retryable_failure", {
            baseUrl: failedHeartbeatUnavailableError.baseUrl,
            errorCode: failedHeartbeatUnavailableError.code,
            message: failedHeartbeatUnavailableError.message
          });
        }
      }

      if (error instanceof InternalApiUnavailableError) {
        const handledAsStartupWait = reportInternalApiStartupUnavailable({
          logger,
          error,
          state: internalApiStartupState,
          workerStartedAtMs,
          startupGracePeriodMs: runtime.internalApiStartupGracePeriodMs
        });

        if (!handledAsStartupWait) {
          logger.warn("internal_api_unavailable_retrying", {
            baseUrl: error.baseUrl,
            errorCode: error.code,
            retryInMs: runtime.pollIntervalMs
          });
        }
      } else {
        logger.error("worker_iteration_failed", {
          error
        });
      }
    }

    if (shutdownRequested) {
      break;
    }

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearTimeout(timeout);
        process.off("SIGINT", cancelDelay);
        process.off("SIGTERM", cancelDelay);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, runtime.pollIntervalMs);

      const cancelDelay = () => {
        cleanup();
        resolve();
      };

      process.once("SIGINT", cancelDelay);
      process.once("SIGTERM", cancelDelay);
    });
  }

  logger.info("worker_stopped", {});
}

if (require.main === module) {
  void startWorkerRuntime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
