import type {
  WorkspaceBoundary,
  WorkspaceBoundaryName
} from "@stealth-trails-bank/types";

export const productionWorkspaceBoundaries = [
  {
    name: "admin",
    kind: "app",
    status: "scaffolded",
    purpose: "internal operator console boundary"
  },
  {
    name: "worker",
    kind: "app",
    status: "active",
    purpose: "asynchronous worker runtime boundary"
  },
  {
    name: "config",
    kind: "package",
    status: "scaffolded",
    purpose: "shared typed configuration boundary"
  },
  {
    name: "types",
    kind: "package",
    status: "scaffolded",
    purpose: "shared domain and workspace types boundary"
  },
  {
    name: "db",
    kind: "package",
    status: "scaffolded",
    purpose: "shared database ownership boundary"
  }
] as const satisfies readonly WorkspaceBoundary[];

export function findWorkspaceBoundary(
  name: WorkspaceBoundaryName
): WorkspaceBoundary | undefined {
  return productionWorkspaceBoundaries.find(
    (workspaceBoundary) => workspaceBoundary.name === name
  );
}
