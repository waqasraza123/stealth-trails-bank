import { findWorkspaceBoundary } from "@stealth-trails-bank/config";
import type { WorkspaceBoundary } from "@stealth-trails-bank/types";

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
