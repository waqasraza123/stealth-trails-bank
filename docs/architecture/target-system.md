# Target System

## Purpose

Stealth Trails Bank should evolve from a prototype DeFi-style monorepo into a production-grade Ethereum financial platform with a bank-like user experience.

The target system must support:
- customer onboarding and account lifecycle
- wallet and custody operations
- deposit and withdrawal flows
- one production-grade yield product
- transaction history
- ledger-backed balances
- admin operations
- treasury controls
- monitoring, reconciliation, and auditability

The target system must not rely on mocked financial flows, ambiguous data ownership, or a single server private key as the root operational model.

## Current Baseline

The current repository contains:
- `apps/web` as the customer-facing React app
- `apps/api` as the NestJS backend
- `packages/contracts` as the Hardhat contract package

Current strengths:
- the repo already has a working monorepo foundation
- the API has real auth, user, pool, deposit, and chain integration paths
- the contracts package already expresses a value-flow product prototype

Current limitations:
- customer-facing financial UI is largely mocked
- contracts are currently failing to compile
- sensitive operational routes are not production-safe
- identity and business data are split across Supabase and Prisma without a clear single source of truth
- there is no worker runtime, admin app, ledger, or reconciliation layer

## Product Shape

The target product is a regulated-ready Ethereum financial platform with a bank-like user interface.

Version 1 should focus on:
- authenticated customer accounts
- account state and policy controls
- wallet/account linkage
- ETH and one stablecoin
- one yield or vault product
- deposits
- withdrawals
- truthful transaction history
- admin operations
- treasury controls
- auditability and observability

Version 1 should not include:
- loans
- broad multi-product DeFi routing
- fake balances
- placeholder asset branches
- unproven credit products

## Monorepo Target Shape

The target monorepo should be organized around clear production boundaries.

### Applications

- `apps/web`
  - customer-facing product UI
  - account, balances, deposits, withdrawals, vaults, history, settings

- `apps/api`
  - synchronous customer and admin HTTP APIs
  - authentication, authorization, policy enforcement, orchestration entrypoints

- `apps/admin`
  - internal operator console
  - reviews, holds, treasury visibility, reconciliation, audit trails, incident actions

- `apps/worker`
  - asynchronous job execution
  - chain indexing, transaction confirmation, reconciliations, notifications, retries

### Packages

- `packages/contracts`
  - production contract system
  - deployment manifests
  - contract tests

- `packages/contracts-sdk`
  - typed contract integration layer
  - chain config, addresses, ABI ownership, read/write adapters

- `packages/db`
  - Prisma schema ownership
  - migrations
  - shared DB client and domain persistence boundaries

- `packages/types`
  - shared domain and API contracts
  - DTO-aligned TypeScript types

- `packages/config`
  - typed environment and configuration loading
  - shared config schemas

- `packages/security`
  - shared security and policy utilities
  - audit event helpers
  - authz and request policy primitives where appropriate

- `packages/ui`
  - shared UI primitives for `apps/web` and `apps/admin` if reuse is justified later

### Documentation

- `docs/architecture`
  - target system, current-vs-target, roadmap, domain boundaries

- `docs/adr`
  - architecture decisions that lock chain, custody, ledger, auth, governance, and repo boundaries

- `docs/runbooks`
  - incident handling, degraded mode, reconciliation repair, treasury operations

## Core Domain Boundaries

The target system should separate the following domains:

### Identity and Accounts
Owns:
- auth identity mapping
- customer profile
- account lifecycle state
- access restrictions
- policy state

### Wallets and Assets
Owns:
- wallet linkage
- supported assets
- wallet-facing metadata
- deposit destination model
- withdrawal destination rules

### Vault Product
Owns:
- one production product primitive
- vault state
- subscriptions
- redemptions
- product-level fees and limits

### Ledger
Owns:
- double-entry journal
- materialized balances
- reserved and pending amounts
- accounting truth for product and customer balances

### Blockchain Operations
Owns:
- transaction intents
- simulation and broadcast workflow
- confirmation tracking
- event ingestion
- chain reconciliation

### Treasury and Governance
Owns:
- operational wallets
- treasury visibility
- governance role boundaries
- emergency controls
- deployment ownership handoff

### Compliance and Risk
Owns:
- account states and restrictions
- hold and review workflows
- operator review queues
- policy-driven action gating

### Audit and Operations
Owns:
- structured audit events
- operational alerts
- incident flows
- repair actions
- runbooks and diagnostics

## Data Ownership Model

The target system needs explicit ownership rules.

### Authentication truth
Supabase may remain the authentication provider, but product business state must live in the platform database.

### Business truth
The platform database must own:
- customer account state
- wallet references
- supported assets
- vault product records
- transaction intents
- ledger journals
- audit events
- event cursors
- policy states

### Settlement truth
Blockchain settlement remains the settlement source of truth for confirmed on-chain value movement.

### Balance truth
Ledger-derived balances become the product source of truth for user-facing balances and accounting views.

The UI must not build balances from mocked data, scattered joins, or ad hoc contract reads.

## Runtime Responsibilities

### Customer request path
`apps/web` calls `apps/api` for all product actions and customer read models.

### Async processing path
`apps/worker` processes:
- deposit detection
- transaction confirmation
- chain event indexing
- retries
- reconciliation jobs
- notifications

### Admin path
`apps/admin` calls admin-scoped APIs in `apps/api`.

### Contract path
`packages/contracts-sdk` becomes the typed integration layer between backend apps and deployed contracts.

## Security Principles

The target system must follow these rules:

- no single server private key controls critical production operations
- no unguarded money-moving routes
- no customer-critical actions without policy checks
- no fake success states for money flows
- no silent balance derivation without ledger support
- no contract changes without deployment manifests and ownership controls
- no admin actions without audit trails

## Operational Principles

The target system must be operable, not just functional.

Required capabilities:
- structured logging
- metrics and alerting
- audit trails
- reconciliation jobs
- retry and dead-letter handling
- incident runbooks
- degraded mode handling
- treasury visibility
- replayable blockchain ingestion

## Immediate Consequences for the Existing Repo

The current repo should be treated as a prototype baseline.

That means:
- no direct promotion of the current staking contract to production without redesign
- no wiring mocked web pages directly into unstable backend routes as if the product is ready
- no expansion of tokens or products before the foundation exists
- no new feature work before architecture decisions and repo restructuring are locked

## Phase 0 Success Criteria

Phase 0 is complete when:
- the target system is documented
- the current-vs-target gap is documented
- the execution roadmap is documented
- the repository has a clear production direction before structural or runtime changes begin
