# Data Model Target

## Purpose

This document defines the target production data model direction for Stealth Trails Bank before live Prisma schema changes begin.

It exists to keep Phase 2 controlled and to avoid ad hoc table edits driven by whichever endpoint or page gets touched next.

## Design Principles

The target data model must support:

- one clean auth to customer mapping
- explicit account lifecycle state
- wallet linkage separated from customer identity
- asset aware money movement
- transaction intent orchestration
- ledger backed balances
- auditability and reconciliation
- admin and compliance controls
- async blockchain processing

The target data model must not depend on:

- scattered user truth across unrelated tables
- direct UI derived balance assumptions
- implicit status fields with unclear ownership
- money movement represented only as one off deposit or withdrawal rows
- contract events as the only business record

## Core Domain Areas

The target model is organized into the following domain areas.

### Identity and Customer Domain

Owns:
- auth identity mapping
- customer profile
- account lifecycle state
- business eligibility
- restriction and review state

### Wallet Domain

Owns:
- wallet references
- wallet kind and custody classification
- chain linkage
- address uniqueness rules
- operational status

### Asset Domain

Owns:
- supported asset registry
- native vs token classification
- decimal precision
- contract address where applicable
- activation state

### Product Domain

Owns:
- vault products
- product activation state
- fees and limits metadata
- customer subscriptions and redemptions

### Transaction Intent Domain

Owns:
- customer requested money movement
- policy gating state
- broadcast lifecycle
- settlement lifecycle
- failure classification
- retry and manual resolution state

### Ledger Domain

Owns:
- journal accounts
- journal entries
- materialized balances
- pending and reserved state
- treasury accounting views

### Blockchain Domain

Owns:
- on chain transaction records
- chain event cursors
- contract registry
- confirmation tracking
- reconciliation linkage

### Operations and Control Domain

Owns:
- audit events
- review cases
- holds and freezes
- repair actions
- operator action history

## Identity and Customer Model

The product needs a clear split between authentication identity and business account state.

### Authentication Identity

Supabase identity proves who signed in.

It should map to one internal customer account record.

### Customer

The customer record should own:
- primary business identity
- profile metadata
- lifecycle state
- review state
- operational restriction state

### Customer Account

A customer may have one primary customer account record in version 1.

That account record should own:
- account status
- product access state
- treasury facing business relationship state
- timestamps for activation, restriction, freeze, or closure

### Required Lifecycle States

Minimum lifecycle states for version 1:

- `registered`
- `email_verified`
- `review_required`
- `active`
- `restricted`
- `frozen`
- `closed`

These states must gate product behavior later.

## Wallet Linkage Model

Wallet ownership must not stay implicit.

The platform needs an explicit wallet model so:
- customer facing wallet references are stable
- custody classification is explicit
- chain ownership is explicit
- deposits and withdrawals can reference the right address records

### Wallet Rules

Version 1 should support explicit wallet records with:
- a linked customer account
- a chain identifier
- a wallet address
- a wallet kind
- a custody classification
- an operational status

### Wallet Kinds

Initial wallet kinds should include:
- `embedded`
- `external`
- `treasury`
- `operational`
- `contract`

### Custody Classifications

Initial custody classifications should include:
- `platform_managed`
- `customer_external`
- `multisig_controlled`
- `contract_controlled`

### Wallet Status

Minimum wallet states:
- `pending`
- `active`
- `restricted`
- `archived`

### Address Rules

For version 1:
- one active wallet address record must be unique per chain
- treasury and customer wallets must not live in the same table without explicit kind and custody fields
- deposit destinations and withdrawal destinations should be modeled as usage patterns over wallet records, not as separate identity systems

## Supported Asset Model

The system needs a canonical asset registry.

Each asset record should express:
- symbol
- display name
- chain identifier
- decimals
- asset type
- contract address for tokens
- active status

Version 1 asset types:
- `native`
- `erc20`

Version 1 should likely support:
- ETH
- one stablecoin

## Product Model

Version 1 should support one product primitive, but it still needs explicit product tables.

### Vault Product

A vault product record should own:
- product code
- display name
- chain identifier
- asset identifier
- contract address
- operational state
- fee references
- capacity or policy metadata

### Product State

Minimum states:
- `draft`
- `active`
- `paused`
- `closed`

### Customer Position

A customer position or subscription model should later represent:
- customer account
- vault product
- share or unit holdings
- principal basis
- state

That position model is not a substitute for ledger truth. It is a product state view.

## Transaction Intent Model

Version 1 must move away from one off deposit and withdrawal rows as the only business representation of money movement.

The platform needs a transaction intent model.

### Intent Categories

Initial categories:
- `deposit`
- `withdrawal`
- `vault_subscription`
- `vault_redemption`
- `treasury_transfer`
- `adjustment`

### Intent Ownership

Each transaction intent should link to:
- one customer account when customer driven
- one asset
- one chain
- one source wallet where relevant
- one destination wallet where relevant
- one requested amount
- one lifecycle state
- one idempotency key
- one policy outcome

### Intent States

Minimum intent states:
- `requested`
- `review_required`
- `approved`
- `queued`
- `broadcast`
- `confirmed`
- `settled`
- `failed`
- `cancelled`
- `manually_resolved`

### Why Intent Exists

The intent model is needed so the platform can separate:
- what the customer requested
- what policy allowed
- what was sent to chain
- what chain settled
- what the ledger recorded

## Ledger Domain

The product needs a proper ledger domain.

The ledger domain must support:
- double entry accounting
- pending and reserved state
- treasury visibility
- customer balance truth
- repairability
- reconciliation

### Ledger Core Objects

The target ledger should later include:
- ledger accounts
- journal batches
- journal entries
- balance snapshots or materialized balances
- reconciliation markers

### Ledger Account Categories

Initial categories should include:
- `customer_asset`
- `customer_pending`
- `customer_reserved`
- `vault_pool`
- `treasury_hot`
- `treasury_reserve`
- `fees_revenue`
- `settlement_transit`
- `adjustment`

### Journal Rules

Each money event must produce balanced journal entries.

Examples:
- deposit recognized
- withdrawal requested
- withdrawal settled
- vault subscription settled
- vault redemption settled
- fee accrual
- manual adjustment with audit trail

### Balance Truth Rule

Customer facing balances must be derived from approved ledger backed read models.

No UI or API should treat:
- raw contract reads
- one off deposit rows
- one off withdrawal rows
- mocked page state

as the primary balance source of truth.

## Audit and Review Domain

The target data model also needs explicit operational objects.

### Review Case

Used for:
- compliance review
- withdrawal review
- mismatch review
- manual intervention

### Hold or Restriction

Used for:
- withdrawal block
- product access restriction
- account freeze
- operational hold

### Audit Event

Used for:
- actor
- action
- target object
- before and after references where relevant
- timestamp
- related request or transaction intent

## Relationship Direction Summary

High level relationship direction:

- one auth identity maps to one customer
- one customer owns one primary customer account in version 1
- one customer account may own multiple wallets
- one asset may be referenced by many transaction intents
- one customer account may create many transaction intents
- one transaction intent may map to zero or more on chain transactions
- one transaction intent may produce one or more journal entries through one journal batch
- one review case may link to a customer account, transaction intent, or reconciliation issue

## What This Document Intentionally Does Not Do

This document does not:
- change the live Prisma schema
- finalize every field name
- finalize every enum value
- define the exact ledger implementation details
- define migration SQL
- authorize endpoint rewrites yet

## Immediate Use

This document should guide:
- the planned Prisma redesign
- the worker state machine design
- the admin operations model
- the later ledger schema
- the contract to product integration model
