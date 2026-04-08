import type { InternalApiUnavailableError } from "./internal-worker-api-client";
import type { WorkerLogger } from "./worker-types";

export type InternalApiStartupAvailabilityState = {
  waitingForAvailabilitySinceMs: number | null;
};

export function createInternalApiStartupAvailabilityState(): InternalApiStartupAvailabilityState {
  return {
    waitingForAvailabilitySinceMs: null
  };
}

export function isWithinInternalApiStartupGracePeriod(args: {
  workerStartedAtMs: number;
  nowMs: number;
  startupGracePeriodMs: number;
}): boolean {
  if (args.startupGracePeriodMs <= 0) {
    return false;
  }

  return args.nowMs - args.workerStartedAtMs < args.startupGracePeriodMs;
}

export function reportInternalApiStartupUnavailable(args: {
  logger: Pick<WorkerLogger, "info">;
  error: InternalApiUnavailableError;
  state: InternalApiStartupAvailabilityState;
  workerStartedAtMs: number;
  startupGracePeriodMs: number;
  nowMs?: number;
}): boolean {
  const nowMs = args.nowMs ?? Date.now();

  if (
    !isWithinInternalApiStartupGracePeriod({
      workerStartedAtMs: args.workerStartedAtMs,
      nowMs,
      startupGracePeriodMs: args.startupGracePeriodMs
    })
  ) {
    return false;
  }

  if (args.state.waitingForAvailabilitySinceMs !== null) {
    return true;
  }

  args.state.waitingForAvailabilitySinceMs = nowMs;
  args.logger.info("internal_api_startup_waiting", {
    baseUrl: args.error.baseUrl,
    errorCode: args.error.code,
    message: args.error.message,
    startupGracePeriodMs: args.startupGracePeriodMs,
    remainingGraceMs: Math.max(
      0,
      args.startupGracePeriodMs - (nowMs - args.workerStartedAtMs)
    )
  });

  return true;
}

export function reportInternalApiStartupAvailable(args: {
  logger: Pick<WorkerLogger, "info">;
  state: InternalApiStartupAvailabilityState;
  baseUrl: string;
  nowMs?: number;
}): void {
  if (args.state.waitingForAvailabilitySinceMs === null) {
    return;
  }

  const nowMs = args.nowMs ?? Date.now();
  const waitDurationMs = Math.max(
    0,
    nowMs - args.state.waitingForAvailabilitySinceMs
  );

  args.state.waitingForAvailabilitySinceMs = null;
  args.logger.info("internal_api_startup_ready", {
    baseUrl: args.baseUrl,
    waitDurationMs
  });
}
