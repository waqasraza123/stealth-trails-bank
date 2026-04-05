import { loadWorkerRuntimeConfig } from "@stealth-trails-bank/config/api";

export type WorkerRuntime = ReturnType<typeof loadWorkerRuntimeConfig>;

export function loadWorkerRuntime(): WorkerRuntime {
  return loadWorkerRuntimeConfig();
}
