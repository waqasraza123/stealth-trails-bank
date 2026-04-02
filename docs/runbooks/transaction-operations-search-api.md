# Transaction Operations Search API

## Purpose

This runbook covers the first internal operator-facing shared operations visibility slice across deposits and withdrawals.

This slice lets operators:

- search transaction intents across both intent types
- inspect audit timelines for a specific transaction intent
- inspect a customer operations snapshot with balances and recent intents

It does not mutate money state.

## Authentication

These endpoints require:

- `x-operator-api-key`
- `x-operator-id`

## Search transaction operations

Endpoint:

    GET /transaction-intents/internal/operations/search?limit=20

Useful filters:

- `intentType`
- `status`
- `assetSymbol`
- `customerAccountId`
- `supabaseUserId`
- `email`
- `txHash`
- `idempotencyKey`

Example:

    GET /transaction-intents/internal/operations/search?intentType=withdrawal&status=settled&email=user@example.com&limit=20

Expected behavior:

- searches across deposit and withdrawal transaction intents on the product chain
- returns customer identity context
- includes latest blockchain transaction when present
- includes wallet and external address context where relevant
- sorts newest first

## Get audit timeline for one transaction intent

Endpoint:

    GET /transaction-intents/internal/operations/:intentId/audit-events

Expected behavior:

- returns ordered `AuditEvent` records for the given transaction intent
- sorts oldest first
- includes:
  - actor type
  - actor id
  - action
  - metadata
  - createdAt

## Get customer operations snapshot

Endpoint:

    GET /transaction-intents/internal/operations/customer-snapshot?supabaseUserId=supabase_1&recentLimit=20

Alternative lookup:

    GET /transaction-intents/internal/operations/customer-snapshot?customerAccountId=account_1&recentLimit=20

Expected behavior:

- requires either:
  - `customerAccountId`
  - or `supabaseUserId`
- returns:
  - customer identity context
  - ledger-backed balances from `CustomerAssetBalance`
  - recent deposit and withdrawal transaction intents
- helps operators explain:
  - current customer balances
  - recent money movement state
  - recent failures, settlements, and tx hashes

## Success condition

A successful operations visibility slice should produce:

- one shared operator search surface across deposit and withdrawal intents
- one audit inspection path by transaction intent
- one customer snapshot path combining balances and recent intent activity
- faster operational debugging without direct database access
