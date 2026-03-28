import { findWorkspaceBoundary } from "@stealth-trails-bank/config";
import type { WorkspaceBoundary } from "@stealth-trails-bank/types";

function requireAdminWorkspaceBoundary(): WorkspaceBoundary {
  const workspaceBoundary = findWorkspaceBoundary("admin");

  if (!workspaceBoundary) {
    throw new Error("Admin workspace boundary is not configured.");
  }

  return workspaceBoundary;
}

export const adminWorkspaceBoundary = requireAdminWorkspaceBoundary();

export function getAdminWorkspaceBoundary(): WorkspaceBoundary {
  return adminWorkspaceBoundary;
}
