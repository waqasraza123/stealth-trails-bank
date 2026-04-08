# Current vs Target

## Purpose

This document maps the current repository state to the target production system so implementation can proceed as a controlled transformation instead of scattered patching.

## Summary

The current repository is no longer only a prototype shell. It now contains:
- customer and operator web surfaces
- a NestJS API with customer, operator, and worker workflow slices
- a worker runtime for async execution and monitoring
- shared config, DB, and type boundaries
- a Hardhat contracts package that compiles and has tests
- early ledger, reconciliation, reporting, and governed export flows

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
- `apps/admin`
- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/contracts`
- `packages/db`
- `packages/types`
- `packages/config`

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
The repo now expresses most of the intended production boundaries. The main repo-boundary gaps are the missing `packages/contracts-sdk` and `packages/security` slices plus deeper operational use of the existing boundaries.

#### Consequence
Boundary drift is no longer the main problem. The main risk now is leaving the introduced boundaries underused or inconsistently hardened across apps.

### Customer UI

#### Current
The customer UI now has real auth and API-backed financial reads across the main customer surface.

Examples:
- auth uses real backend login flows
- dashboard and wallet use real balances and supported assets
- transaction history is backed by API reads
- profile uses customer account data
- staking surfaces use the current backend contract/product routes
- loans remains a constrained placeholder surface rather than a finished product path

#### Target
Every customer-facing financial page must be backed by real APIs and truthful read models.

#### Gap
The customer UI is materially more truthful than the earlier architecture baseline, but it still does not represent a finished production banking experience.

#### Consequence
The remaining risk is not mock-heavy UI drift so much as overextending partially implemented product areas before underlying controls are complete.

### Backend API

#### Current
The API already contains:
- auth
- user and customer account reads
- customer balances
- deposit and withdrawal intent APIs
- transaction history and operations reporting
- review cases and manual resolution reporting
- oversight incidents and account hold reporting
- governed incident package export and release workflows
- internal worker and internal operator guarded routes
- staking, pool, asset, and Ethereum integration paths
- ledger services and settlement reconciliation slices

#### Target
The API should expose:
- customer APIs
- admin APIs
- policy-safe money movement entrypoints
- idempotent actions
- audit event emission
- clean domain boundaries

#### Gap
The API has moved far beyond the earlier prototype baseline, but it still mixes mature operational slices with unfinished product areas and incomplete production control-plane hardening.

#### Consequence
The remaining work is about consistency, observability, and hardening rather than absence of domain APIs.

### Contracts

#### Current
The contracts package contains a prototype staking contract system that now compiles and has passing tests.

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
The repo now includes customer balance projections plus ledger journals and postings for implemented settlement and reservation flows.

#### Target
Balances must be ledger-derived and reconcilable.

#### Gap
The accounting core has started, but ledger coverage is still partial and the reconciliation/reporting surface is not yet broad enough to treat the whole platform as fully ledger-derived.

#### Consequence
Customer balances are stronger than the original baseline, but extension into more products without broader ledger coverage would still be fragile.

### Blockchain Processing

#### Current
The repository now contains a dedicated worker runtime with internal API polling, synthetic mode, monitor mode, managed deposit broadcasting, retry handling, and test coverage.

#### Target
Blockchain processing should be handled by an async worker system with:
- durable cursors
- retries
- transaction state machine
- replay support
- reconciliation hooks

#### Gap
The repo now has a real worker boundary and orchestration loop, but it still lacks a fuller queue-based execution substrate, broader ingestion coverage, and stronger replay/operability guarantees.

#### Consequence
Chain processing is less fragile than the earlier baseline, but it still needs stronger production recovery and observability characteristics.

### Admin and Operations

#### Current
The repository now includes an internal operator console for review cases, oversight incidents, hold-release reviews, incident package export governance, reconciliation mismatch handling, audit-log inspection, and treasury visibility.

#### Target
A dedicated internal surface must exist for:
- account review
- holds
- treasury visibility
- reconciliation mismatch review
- audit event inspection
- incident actions

#### Gap
Critical operator loops now have an internal UI, but deeper treasury/governance controls and incident-management automation are still incomplete.

#### Consequence
Without deeper admin coverage, operators will still fall back to logs, scripts, or direct data inspection for some important workflows.

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
The repo now has runbooks, reconciliation services, reporting slices, targeted repair tooling, worker heartbeat persistence, scheduled reconciliation scan history, operator-visible runtime health views, structured API request logging with correlation ids, an internal Prometheus-style metrics surface for API and worker boundaries, alert-routing automation that converts critical platform alerts into manual-intervention review cases, durable alert ownership/acknowledgement/suppression controls, runtime-configured external webhook delivery targets with durable delivery attempts and retry support, category-specific auto-routing policies for eligible alert classes, failover-only delivery targets with durable escalation ancestry, time-based re-escalation for overdue critical alerts, delivery-target health reporting, and SLO-backed alerting on sustained delivery-target degradation, but not a full platform-wide observability stack.

#### Target
The system must provide:
- structured logs
- metrics
- alerting
- reconciliation jobs
- operator repair actions
- incident runbooks

#### Gap
The repo is more operable than the original baseline, and it now has a durable release-readiness evidence workflow for recording staging or production-like alerting and rollback proof, but actual staged proof for the new alert-delivery SLO controls, broader reconciliation depth, and broader release-proof coverage are still missing.

#### Consequence
Failures are easier to detect, route, auto-triage, and escalate externally than before, but release confidence still depends too heavily on proving the new controls against production-like traffic and disaster-recovery evidence instead of only code-level implementation.

## Transformation Strategy

The repository should not be treated as if it were still stuck before the worker, ledger, and admin boundaries exist.

The practical transformation order from the current repo position is:
1. keep architecture and roadmap docs aligned with implemented reality
2. continue hardening the data model, auth boundary, and policy controls already introduced
3. deepen worker recovery, replay, and operational safety
4. extend ledger coverage and reconciliation reporting
5. keep customer and operator surfaces truthful as backend slices mature
6. expand observability, incident response, and release hardening
7. finish contract and governance hardening before any real launch posture

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

The current repository already contains meaningful production-oriented slices across customer, operator, worker, ledger, and governed export workflows.

The next step after this document is not more placeholder boundary work. It is to harden observability, reconciliation, and operational safety around the slices that already exist.
