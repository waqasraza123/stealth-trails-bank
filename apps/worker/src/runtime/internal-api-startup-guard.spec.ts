import assert from "node:assert/strict";
import test from "node:test";
import { InternalApiUnavailableError } from "./internal-worker-api-client";
import {
  createInternalApiStartupAvailabilityState,
  isWithinInternalApiStartupGracePeriod,
  reportInternalApiStartupAvailable,
  reportInternalApiStartupUnavailable
} from "./internal-api-startup-guard";

test("startup grace period applies only within the configured window", () => {
  assert.equal(
    isWithinInternalApiStartupGracePeriod({
      workerStartedAtMs: 1_000,
      nowMs: 20_000,
      startupGracePeriodMs: 45_000
    }),
    true
  );

  assert.equal(
    isWithinInternalApiStartupGracePeriod({
      workerStartedAtMs: 1_000,
      nowMs: 46_000,
      startupGracePeriodMs: 45_000
    }),
    false
  );
});

test("startup unavailability is logged once during the grace period and reset on recovery", () => {
  const events: Array<{ event: string; metadata: Record<string, unknown> }> = [];
  const state = createInternalApiStartupAvailabilityState();
  const error = new InternalApiUnavailableError({
    baseUrl: "http://localhost:9101",
    code: "ECONNREFUSED",
    message: "Internal API is not accepting connections at http://localhost:9101.",
    cause: new Error("refused")
  });

  const handled = reportInternalApiStartupUnavailable({
    logger: {
      info(event, metadata) {
        events.push({ event, metadata });
      }
    },
    error,
    state,
    workerStartedAtMs: 1_000,
    startupGracePeriodMs: 45_000,
    nowMs: 10_000
  });

  assert.equal(handled, true);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event, "internal_api_startup_waiting");

  const repeatedHandled = reportInternalApiStartupUnavailable({
    logger: {
      info(event, metadata) {
        events.push({ event, metadata });
      }
    },
    error,
    state,
    workerStartedAtMs: 1_000,
    startupGracePeriodMs: 45_000,
    nowMs: 20_000
  });

  assert.equal(repeatedHandled, true);
  assert.equal(events.length, 1);

  reportInternalApiStartupAvailable({
    logger: {
      info(event, metadata) {
        events.push({ event, metadata });
      }
    },
    state,
    baseUrl: "http://localhost:9101",
    nowMs: 25_000
  });

  assert.equal(events.length, 2);
  assert.equal(events[1]?.event, "internal_api_startup_ready");
});

test("startup unavailability falls through after the grace period", () => {
  const handled = reportInternalApiStartupUnavailable({
    logger: {
      info() {
        throw new Error("should not log inside expired grace period");
      }
    },
    error: new InternalApiUnavailableError({
      baseUrl: "http://localhost:9101",
      code: "ECONNREFUSED",
      message: "Internal API is not accepting connections at http://localhost:9101.",
      cause: new Error("refused")
    }),
    state: createInternalApiStartupAvailabilityState(),
    workerStartedAtMs: 1_000,
    startupGracePeriodMs: 45_000,
    nowMs: 60_000
  });

  assert.equal(handled, false);
});
