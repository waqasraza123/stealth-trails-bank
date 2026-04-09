# Deposit Intent Confirmation and Settlement API

## Purpose

This runbook covers the first money-truth slice for deposits.

This slice lets the system move from:

- broadcast
- confirmed
- settled

and introduces:

- minimal ledger journal posting
- ledger-backed customer asset balances

It does not yet cover:

- generalized ledger across all products
- withdrawal settlement
- reconciliation jobs
- automatic confirmation ingestion
- final admin console views

## Worker authentication

Worker endpoints require:

- `x-worker-api-key`
- `x-worker-id`

## List broadcast deposit intents

Endpoint:

```text
GET /transaction-intents/internal/worker/deposit-requests/broadcast?limit=20
```

Expected behavior:

- returns deposit intents with:
  - `status = broadcast`
  - `policyDecision = approved`
- includes latest blockchain transaction

## List confirmed deposit intents ready for settlement recovery

Endpoint:

```text
GET /transaction-intents/internal/worker/deposit-requests/confirmed-ready-to-settle?limit=20
```

Expected behavior:

- returns deposit intents with:
  - `status = confirmed`
  - `policyDecision = approved`
  - latest blockchain transaction status = `confirmed`
  - no existing `LedgerJournal`
- sorts oldest first
- lets the worker recover intents stranded after confirmation if a prior settle call failed or timed out

## Confirm a broadcast deposit intent

Endpoint:

```text
POST /transaction-intents/internal/worker/deposit-requests/:intentId/confirm
```

Example body:

```json
{
  "txHash": "0x1111111111111111111111111111111111111111111111111111111111111111"
}
```

Expected behavior:

- requires latest blockchain transaction to exist
- requires:
  - `status = broadcast`
  - `policyDecision = approved`
- updates:
  - `BlockchainTransaction.status = confirmed`
  - `BlockchainTransaction.confirmedAt`
  - `TransactionIntent.status = confirmed`
- writes:
  - `AuditEvent.action = transaction_intent.deposit.confirmed`

## Settle a confirmed deposit intent

Endpoint:

```text
POST /transaction-intents/internal/worker/deposit-requests/:intentId/settle
```

Example body:

```json
{
  "note": "Confirmed deposit posted into ledger."
}
```

Expected behavior:

- requires:
  - `status = confirmed`
  - `policyDecision = approved`
  - latest blockchain transaction status = `confirmed`
- creates one `LedgerJournal`
- creates two `LedgerPosting` rows:
  - debit inbound clearing
  - credit customer liability
- upserts and increments `CustomerAssetBalance`
- updates:
  - `TransactionIntent.status = settled`
  - `TransactionIntent.settledAmount = requestedAmount`
- writes:
  - `AuditEvent.action = transaction_intent.deposit.settled`

## Customer ledger-backed balances

Endpoint:

```text
GET /balances/me
```

Expected behavior:

- returns balances from `CustomerAssetBalance`
- not from ad hoc workflow state
- each row includes:
  - asset
  - availableBalance
  - pendingBalance
  - updatedAt

## Success condition

A successful confirm-and-settle slice should produce:

- broadcast deposit intents moving into confirmed
- confirmed deposit intents moving into settled
- one ledger journal per settled deposit intent
- two ledger postings per settlement
- a durable customer asset balance read model
- customer-visible ledger-backed balances
