export type WorkspaceBoundaryKind = "app" | "package";

export type WorkspaceBoundaryStatus = "scaffolded" | "planned" | "active";

export type WorkspaceBoundaryName =
  | "admin"
  | "worker"
  | "config"
  | "types"
  | "db";

export type WorkspaceBoundary = {
  readonly name: WorkspaceBoundaryName;
  readonly kind: WorkspaceBoundaryKind;
  readonly status: WorkspaceBoundaryStatus;
  readonly purpose: string;
};
