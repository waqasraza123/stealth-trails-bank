import type { WorkerRuntime } from "./worker-runtime";
import type { WorkerLogger } from "./worker-types";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

export function createWorkerLogger(runtime: WorkerRuntime): WorkerLogger {
  const writeLog = (
    level: "info" | "warn" | "error",
    event: string,
    metadata: Record<string, unknown>
  ) => {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      workerId: runtime.workerId,
      event,
      ...metadata
    };

    const serializedPayload = JSON.stringify(payload);

    if (level === "error") {
      console.error(serializedPayload);
      return;
    }

    if (level === "warn") {
      console.warn(serializedPayload);
      return;
    }

    console.log(serializedPayload);
  };

  return {
    info(event, metadata) {
      writeLog("info", event, metadata);
    },
    warn(event, metadata) {
      writeLog("warn", event, metadata);
    },
    error(event, metadata) {
      writeLog("error", event, {
        ...metadata,
        error: serializeError(metadata.error)
      });
    }
  };
}
