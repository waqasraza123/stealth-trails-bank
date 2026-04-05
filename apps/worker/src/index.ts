import { findWorkspaceBoundary } from "@stealth-trails-bank/config";
import type { WorkspaceBoundary } from "@stealth-trails-bank/types";
import { createInternalWorkerApiClient } from "./runtime/internal-worker-api-client";
import { createManagedDepositBroadcaster } from "./runtime/deposit-broadcaster";
import { createJsonRpcClient } from "./runtime/json-rpc-client";
import { createWorkerLogger } from "./runtime/worker-logger";
import { WorkerOrchestrator } from "./runtime/worker-orchestrator";
import { loadWorkerRuntime } from "./runtime/worker-runtime";

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
  const orchestrator = new WorkerOrchestrator({
    runtime,
    internalApiClient,
    rpcClient,
    depositBroadcaster,
    logger
  });

  let shutdownRequested = false;

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
    confirmationBlocks: runtime.confirmationBlocks
  });

  while (!shutdownRequested) {
    try {
      await orchestrator.runOnce();
    } catch (error) {
      logger.error("worker_iteration_failed", {
        error
      });
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
