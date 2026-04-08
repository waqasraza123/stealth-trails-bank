# Production Roadmap

## Purpose

This document turns the target production direction into a repo-specific execution sequence.

It is intentionally phase-based so each step can be implemented, verified, and committed without mixing foundational architecture work with late-stage product work.

## Current Execution Status

- Phase 1 is materially complete at the repo-boundary level: `apps/admin`, `apps/worker`, `packages/db`, `packages/types`, and `packages/config` now exist.
- Phase 2 and Phase 3 are materially advanced through the current Prisma domain model, customer-account slices, and auth/account lifecycle work.
- Phase 6 is materially advanced through the worker runtime and internal worker execution paths.
- Phase 7 is partially implemented through ledger journals/postings, balance materialization, and reconciliation services.
- Phase 8 and Phase 9 are materially advanced through the current API and truthful customer web surfaces.
- Phase 10 is materially complete at the operator-visibility level through the console for review, oversight, hold-release, reconciliation mismatch, governed export, audit-log, and treasury visibility workflows.
- Phase 11 is materially advanced through worker heartbeat reporting, scheduled reconciliation scan history, durable platform alerts, operator-visible runtime health, structured API request logging with request correlation IDs, an internal Prometheus-style metrics surface spanning API requests and worker execution, alert-routing automation that opens manual-intervention review cases from platform alerts, durable alert ownership, acknowledgement, and suppression controls, runtime-configured external alert delivery targets with durable delivery attempts and retry support, category-specific automation policies that auto-route eligible alert classes into review work, failover-only delivery targets with durable escalation ancestry, time-based re-escalation for overdue critical alerts, delivery-target health reporting, and SLO-backed alerting on sustained delivery-target degradation.
- Phase 12 has begun through the repo-specific threat model, secret handling review, role review, restore and rollback drills, launch checklist, and durable release-readiness evidence tracking for staging or production-like proof capture, but release proof remains outstanding.

Current active execution frontier:
- Phase 11/12 boundary hardening

Immediate next execution step:
- run the delivery-target SLO, critical alert re-escalation, restore, and rollback drills against staging or production-like traffic and record the resulting evidence through the new release-readiness workflow

## Phase Order

1. Phase 0 — Architecture baseline
2. Phase 1 — Monorepo restructuring
3. Phase 2 — Data model redesign
4. Phase 3 — Auth and account lifecycle rebuild
5. Phase 4 — Product contract redesign
6. Phase 5 — Treasury and governance controls
7. Phase 6 — Worker and blockchain orchestration
8. Phase 7 — Ledger and reconciliation
9. Phase 8 — Backend API rebuild
10. Phase 9 — Customer web replacement of mocked flows
11. Phase 10 — Admin console
12. Phase 11 — Observability and incident safety
13. Phase 12 — Security hardening and release readiness

## Phase 0 — Architecture Baseline

### Objective
Create the written production baseline that later code changes must follow.

### Deliverables
- `docs/architecture/target-system.md`
- `docs/architecture/current-vs-target.md`
- `docs/architecture/production-roadmap.md`

### Questions intentionally deferred to ADRs
- exact chain choice
- exact custody model
- exact vault product model
- exact governance ownership model
- exact auth and account lifecycle mapping
- exact shared package boundaries

### Exit Criteria
- target system is documented
- current-vs-target gap is documented
- production roadmap is documented

## Phase 1 — Monorepo Restructuring

### Objective
Strengthen and use the production boundaries already introduced in the repository.

### Delivered Outputs
- `apps/admin`
- `apps/worker`
- `packages/db`
- `packages/types`
- `packages/config`

### Remaining Outputs
- `packages/contracts-sdk`
- `packages/security`

### Rules
- additive first
- do not break existing app startup paths unnecessarily
- keep behavior stable while boundaries are introduced

### Exit Criteria
- the repo expresses the intended production boundaries
- shared config and shared types stop living only inside individual apps
- Prisma ownership is clearly located
- the admin and worker boundaries are exercised by real runtime code, not only placeholders

## Phase 2 — Data Model Redesign

### Objective
Replace the current prototype-oriented storage model with a production domain model.

### Planned Areas
- customer account model
- wallet linkage
- supported assets
- product records
- transaction intents
- ledger journals
- event cursors
- audit events
- policy and restriction states

### Exit Criteria
- one clear business data model exists
- ambiguous user ownership is removed
- migrations express the product domains correctly

## Phase 3 — Auth and Account Lifecycle Rebuild

### Objective
Make authentication, account state, and authorization production-safe.

### Planned Areas
- auth identity mapping
- account lifecycle states
- admin auth boundary
- sensitive action policy checks
- route cleanup
- dead dependency cleanup where justified

### Exit Criteria
- one clean auth-to-customer mapping exists
- protected routes have real authorization
- sensitive money-related actions are policy-gated

## Phase 4 — Product Contract Redesign

### Objective
Replace the prototype staking contract path with a production-grade product contract system.

### Planned Areas
- product contract spec
- access and emergency controls
- fee model
- treasury receiver path
- deployment manifests
- contract tests

### Exit Criteria
- one approved product primitive exists
- value flows are tested
- deployment process exists

## Phase 5 — Treasury and Governance Controls

### Objective
Remove unsafe production control assumptions.

### Planned Areas
- operator roles
- treasury boundaries
- governance ownership
- emergency control model
- deployment ownership handoff

### Exit Criteria
- no critical control depends only on one backend key
- governance responsibilities are explicit

## Phase 6 — Worker and Blockchain Orchestration

### Objective
Move chain processing into durable async flows.

### Delivered or Materially Advanced Areas
- worker app
- transaction intent polling/orchestration loop
- confirmation tracking
- retry handling
- synthetic, monitor, and managed execution modes

### Remaining Areas
- queue setup
- broader event ingestion
- fuller replay support
- stronger operational recovery guarantees

### Exit Criteria
- chain processing is async-safe
- event handling is replayable
- failure recovery is structured

## Phase 7 — Ledger and Reconciliation

### Objective
Make balances auditable and operationally repairable.

### Delivered or Materially Advanced Areas
- double-entry journal foundations
- balance materialization
- settlement and reconciliation service slices

### Remaining Areas
- broader reconciliation jobs
- mismatch reporting
- richer operator repair actions

### Exit Criteria
- balances are ledger-derived
- reconciliation reports exist
- mismatch handling exists

## Phase 8 — Backend API Rebuild

### Objective
Replace prototype routes with customer-safe and admin-safe APIs.

### Delivered or Materially Advanced Areas
- account APIs
- balance APIs
- deposit and withdrawal intent APIs
- product APIs
- review case APIs
- oversight incident APIs
- incident package governance APIs

### Remaining Areas
- admin APIs
- idempotency
- audit emission

### Exit Criteria
- no unguarded money-sensitive endpoints remain
- API boundaries align to the new domains

## Phase 9 — Customer Web Replacement of Mocked Flows

### Objective
Replace mocked finance UX with truthful customer flows.

### Delivered or Materially Advanced Areas
1. auth and account state
2. dashboard and balances
3. deposit and withdrawal flows
4. product flows
5. transaction history

### Remaining Areas
6. security settings
7. any unfinished placeholder product surfaces

### Exit Criteria
- no mocked production finance flows remain
- all customer financial state comes from real APIs and read models

## Phase 10 — Admin Console

### Objective
Create the internal operating surface required for a professional platform.

### Delivered or Materially Advanced Areas
- customer search
- review and hold flows
- incident actions
- reconciliation mismatch review and repair
- governed incident package release workflows
- audit log inspection
- treasury visibility

### Remaining Areas
- none currently identified in the admin visibility surface

### Exit Criteria
- operators can manage the system without direct DB access or log diving for routine actions

## Phase 11 — Observability and Incident Safety

### Objective
Make the platform operable under real failure conditions.

### Planned Areas
- structured logs
- metrics
- alerts
- chain health
- treasury health
- queue health
- runbooks

### Exit Criteria
- critical failures can be detected and responded to quickly
- incident flows are documented

## Phase 12 — Security Hardening and Release Readiness

### Objective
Prove the release candidate before any real launch posture.

### Planned Areas
- contract tests and invariants
- backend integration tests
- end-to-end finance flows
- threat model
- secret handling review
- role review
- restore and rollback drills
- launch checklist

### Exit Criteria
- critical risks are addressed
- checks prove the release candidate
- launch checklist is ready

## Commit Strategy

The repo should move through this roadmap using small but meaningful cohesive commits.

Recommended pattern:
- docs-only commits first
- additive scaffolding commits next
- domain-model commits before behavior rewrites
- async and ledger foundations before customer UI rewiring
- admin and observability before release readiness

## What This Roadmap Does Not Authorize

This roadmap does not authorize:
- rushing customer-facing feature work before the foundation is in place
- patching the current staking path into production by incremental hacks
- calling the platform production-grade before ledger, governance, and operational controls exist
- treating passing UI demos as proof of money-flow correctness

## Immediate Next Step

The next step after landing this roadmap is to add ADRs that lock:
- chain strategy
- custody model
- ledger source of truth
- governance model
- auth and account lifecycle direction
- monorepo package boundaries
