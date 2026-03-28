# Current vs Target

## Purpose

This document maps the current repository state to the target production system so implementation can proceed as a controlled transformation instead of scattered patching.

## Summary

The current repository is a prototype with useful building blocks:
- a customer-facing web app shell
- a NestJS API with real auth and blockchain integration paths
- a Hardhat contracts package with prototype product logic

The target repository is a production-grade Ethereum financial platform with:
- clear repo boundaries
- one account model
- one balance model
- one production product contract system
- async blockchain processing
- admin operations
- auditability and reconciliation

## Gap Matrix

### Repo Structure

#### Current
- `apps/web`
- `apps/api`
- `packages/contracts`

#### Target
- `apps/web`
- `apps/api`
- `apps/admin`
- `apps/worker`
- `packages/contracts`
- `packages/contracts-sdk`
- `packages/db`
- `packages/types`
- `packages/config`
- `packages/security`

#### Gap
The repo currently lacks the packages and apps needed to express production boundaries.

#### Consequence
If we keep adding features to the current layout, business logic, blockchain logic, and operational tooling will become tightly coupled and harder to harden.

### Customer UI

#### Current
The customer UI has real routing and shared UI primitives, but major financial pages remain mocked.

Examples:
- dashboard is mocked
- staking is mocked
- create pool is mocked
- transactions are mocked
- loans is UI-only

#### Target
Every customer-facing financial page must be backed by real APIs and truthful read models.

#### Gap
The current UI implies product maturity that does not yet exist in the backend.

#### Consequence
Wiring fake pages directly to unstable prototype APIs would create rework and trust issues.

### Backend API

#### Current
The API already contains:
- auth
- user fetch
- deposits
- pool routes
- staking routes
- Ethereum event listening

#### Target
The API should expose:
- customer APIs
- admin APIs
- policy-safe money movement entrypoints
- idempotent actions
- audit event emission
- clean domain boundaries

#### Gap
The current API still mixes prototype flows and production-sensitive actions without the necessary control plane.

#### Consequence
Money-moving logic is not yet guarded or structured well enough for production.

### Contracts

#### Current
The contracts package contains a prototype staking contract system and currently fails to compile.

#### Target
The contracts package should contain:
- one production-grade product primitive
- governance and emergency controls
- clear deployment ownership
- tests that prove value flows
- repeatable deployment artifacts

#### Gap
The current contract system is not yet ready to be the foundation of a financial product.

#### Consequence
We should not optimize or wire the current contract into the customer product as if it were final.

### Identity and User Model

#### Current
Identity and business data are split across Supabase and Prisma in a way that is not yet cleanly modeled.

#### Target
One explicit identity mapping:
- auth provider identity
- internal customer record
- account state
- wallet linkage
- policy state

#### Gap
The repo does not yet have a single, clean customer account model.

#### Consequence
Auth and product flows risk drift, duplication, and authorization gaps.

### Balance Model

#### Current
The repo contains product tables for deposits and withdrawals, but it does not have a formal ledger.

#### Target
Balances must be ledger-derived and reconcilable.

#### Gap
There is no accounting core that can support production-grade financial state.

#### Consequence
Customer balances, treasury views, and operational repair flows would remain fragile.

### Blockchain Processing

#### Current
The API contains direct chain interaction and a thin event listener.

#### Target
Blockchain processing should be handled by an async worker system with:
- durable cursors
- retries
- transaction state machine
- replay support
- reconciliation hooks

#### Gap
The repo has no worker runtime or durable async orchestration.

#### Consequence
Chain operations remain fragile and hard to recover under failure.

### Admin and Operations

#### Current
There is no admin app and no dedicated operator experience.

#### Target
A dedicated internal surface must exist for:
- account review
- holds
- treasury visibility
- reconciliation mismatch review
- audit event inspection
- incident actions

#### Gap
Critical operations currently have no production operating surface.

#### Consequence
Important workflows would otherwise be hidden in logs, direct DB access, or ad hoc scripts.

### Governance and Treasury

#### Current
The system direction still assumes server-side key-driven operations.

#### Target
Governance and treasury boundaries must be explicit:
- operational wallet boundaries
- multisig ownership for sensitive control
- emergency procedures
- documented ownership handoff

#### Gap
The repo has not yet formalized a production-safe treasury and governance model.

#### Consequence
The current model is not acceptable for a professional financial platform.

### Observability and Reconciliation

#### Current
There is no real observability, reconciliation layer, or operator repair path.

#### Target
The system must provide:
- structured logs
- metrics
- alerting
- reconciliation jobs
- operator repair actions
- incident runbooks

#### Gap
The repo is not yet operable as a financial system.

#### Consequence
Failures would be harder to detect, classify, and repair safely.

## Transformation Strategy

The repository should not be transformed by patching random broken screens and routes first.

The transformation should follow this order:
1. lock architecture and roadmap docs
2. restructure the monorepo
3. redesign the data model
4. rebuild auth and account lifecycle
5. redesign the product contracts
6. add worker and blockchain orchestration
7. add ledger and reconciliation
8. rebuild backend APIs on the new foundation
9. replace mocked customer flows
10. add admin operations
11. add observability and release hardening

## What Must Not Happen

The following are explicitly unsafe transformation patterns:

- treating current prototype routes as stable production contracts
- wiring mocked web pages directly to unstable finance endpoints
- expanding token support before one asset model is correct
- keeping identity and balances split across unclear truths
- relying on a single runtime secret for critical treasury power
- postponing ledger and reconciliation until after customer feature wiring
- building loans before core money movement is proven

## Immediate Planning Outcome

The current repository is good enough to begin a structured production transformation, but not good enough to support direct feature expansion as if it were already a production-grade financial platform.

The next step after this document is to keep decisions moving forward in writing and then start the additive repo restructuring phase.
