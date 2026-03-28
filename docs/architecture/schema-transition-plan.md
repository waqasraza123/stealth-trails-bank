# Schema Transition Plan

## Purpose

This document defines how Stealth Trails Bank should move from the current prototype Prisma schema to the target production data model without destabilizing runtime behavior.

This is a transition plan, not a migration itself.

## Current Live Schema Summary

The live schema currently centers around:
- `User`
- `StakingPool`
- `PoolDeposit`
- `PoolWithdrawal`

That schema is enough for the prototype, but it is not enough for:
- account lifecycle states
- wallet linkage
- asset registry
- transaction intent orchestration
- ledger backed balances
- review and restriction workflows
- auditability

## Transition Principles

The schema transition should follow these rules:

- additive first
- keep the live product working while new tables are introduced
- avoid renaming or repurposing old tables in place when new domain meaning is materially different
- backfill and dual read only when needed and explicitly planned
- do not mix unrelated domain redesigns into one migration
- do not introduce ledger tables without their domain plan
- do not delete current prototype tables until successor reads and writes are proven

## Recommended Transition Sequence

## Step 1 — Add Core Customer and Account Tables

First schema change should introduce:
- `Customer`
- `CustomerAccount`
- new lifecycle enums

This gives the product:
- one internal customer identity
- one business account state model
- a clean bridge from Supabase auth to platform business state

### Why first

Every later domain depends on correct customer and account ownership.

## Step 2 — Add Wallet and Asset Registry Tables

Next schema change should introduce:
- `Wallet`
- `Asset`

This gives the platform:
- explicit wallet ownership and custody typing
- explicit chain aware asset references
- a clean base for deposits, withdrawals, and product contracts

### Why second

Transaction intents and product records should not be created before wallet and asset references exist.

## Step 3 — Add Product Tables

Next schema change should introduce:
- `VaultProduct`

This gives the platform:
- a stable product registry
- a clean successor to prototype staking pool semantics

### Why third

The product table should exist before transactional orchestration starts referencing it.

## Step 4 — Add Transaction Intent and Blockchain Transaction Tables

Next schema change should introduce:
- `TransactionIntent`
- `BlockchainTransaction`

This gives the platform:
- a durable business workflow state
- a clean handoff between customer requests, worker orchestration, and settlement tracking

### Why fourth

The intent model needs customer, wallet, asset, and product references already available.

## Step 5 — Add Review and Audit Tables

Next schema change should introduce:
- `ReviewCase`
- `AuditEvent`

This gives the platform:
- operator review and restriction handling
- actor and action history

### Why fifth

Operational control becomes meaningful once customer and transaction objects exist.

## Step 6 — Add Ledger Tables

Next schema change should introduce:
- `JournalAccount`
- `JournalBatch`
- `JournalEntry`

This gives the platform:
- accounting truth
- balance derivation
- reconciliation hooks

### Why sixth

Ledger should be introduced deliberately after the intent and asset shapes are clear.

## Step 7 — Add Balance Materialization or Read Models

If needed later, add:
- balance snapshot tables
- materialized views
- reconciliation support tables

This should happen after the journal model is settled.

## Compatibility Strategy

### Prototype coexistence period

The existing prototype tables may coexist temporarily while the new tables are introduced.

### Early compatibility rule

Do not force old tables to pretend to be the new model.

### Migration style

Prefer:
- new table introduction
- explicit backfill when needed
- explicit write path changes
- explicit read path migration

Avoid:
- magical meaning shifts in old columns
- hidden table repurposing
- mixed semantic use of old and new rows without documentation

## Initial Read and Write Strategy

Recommended progression:

### Stage A

Add new tables only.
No runtime writes yet.

### Stage B

Begin writing selected new domain records in parallel where safe.

### Stage C

Move targeted reads to new tables once data is proven.

### Stage D

Stop writing obsolete prototype tables once successor paths are stable.

### Stage E

Only then consider removing or archiving obsolete tables.

## Risk Controls

The schema redesign should explicitly avoid these mistakes:

- changing too many domains in one migration
- introducing ledger before intent semantics are clear
- mixing product redesign and ledger redesign in one giant step
- deleting prototype tables too early
- rewriting all reads at once
- assuming a passing migration means the business model is sound

## Immediate Follow On Planning Use

This plan should guide the first real Phase 2 schema commit.

That commit should likely focus only on:
- `Customer`
- `CustomerAccount`
- lifecycle enums

and should not yet attempt:
- wallet tables
- transaction intent tables
- ledger tables
- prototype table deletion

## What Remains Intentionally Deferred

This document does not yet define:
- exact migration SQL
- exact backfill scripts
- exact dual write strategy
- exact ledger account seeding
- exact balance read models

Those should be addressed in smaller, domain specific commits once the first schema groundwork lands.
