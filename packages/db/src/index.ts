import type { WorkspaceBoundary } from "@stealth-trails-bank/types";

export const databaseWorkspaceBoundary: WorkspaceBoundary = {
  name: "db",
  kind: "package",
  status: "scaffolded",
  purpose: "shared prisma schema, migrations, and database access boundary"
};

export type DatabasePackageScope = {
  readonly ownsPrismaSchema: true;
  readonly ownsMigrations: true;
  readonly ownsSharedDatabaseAccess: true;
};

export const databasePackageScope: DatabasePackageScope = {
  ownsPrismaSchema: true,
  ownsMigrations: true,
  ownsSharedDatabaseAccess: true
};
