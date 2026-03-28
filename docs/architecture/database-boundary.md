# Database Boundary

## Purpose

This document defines the transitional database ownership model while the repository moves from a prototype structure to the target production monorepo shape.

## Current State

The Prisma schema and migration workflow currently live under:

- `apps/api/prisma/schema.prisma`

The API package also owns the operational Prisma commands today:
- `pnpm --filter @stealth-trails-bank/api prisma:generate`
- `pnpm --filter @stealth-trails-bank/api prisma:migrate`
- `pnpm --filter @stealth-trails-bank/api prisma:studio`

The Nest API currently instantiates Prisma directly from its local service layer.

## Decision For This Phase

In this phase, `packages/db` becomes the shared Prisma client boundary for the monorepo.

That means:

- shared Prisma client export moves to `packages/db`
- application packages consume Prisma through `@stealth-trails-bank/db`
- schema and migrations remain physically in `apps/api/prisma` for now
- Prisma CLI commands remain in `apps/api` for now

This is an additive transition step. It intentionally avoids moving schema files and migration workflows until the shared boundary is proven stable.

## Ownership Model In This Phase

### `packages/db` owns
- shared Prisma client export
- shared database access boundary
- future home for schema and migration ownership after the transition is completed

### `apps/api` still owns temporarily
- the physical schema file
- migration command execution
- Prisma generate command execution
- current operational Prisma workflow

## Why This Transition Exists

We need a stable database boundary before:
- redesigning the data model
- moving schema ownership physically
- expanding worker and admin data access
- building ledger and reconciliation services

Moving the shared client boundary first is safer than moving schema, commands, and runtime wiring all at once.

## Future Intended State

A later phase should move full Prisma ownership into `packages/db`, including:
- schema file ownership
- migration ownership
- shared DB runtime access
- any shared database utilities

That move should happen only after:
- the shared client boundary is proven
- API adoption is stable
- the repo has fewer unrelated failures in flight

## Rules For The Transition

- do not duplicate Prisma client initialization across packages
- do not change runtime query behavior in this phase
- do not move migrations yet
- do not treat this step as the final database architecture
