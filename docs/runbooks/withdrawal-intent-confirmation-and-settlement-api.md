# Withdrawal Intent Confirmation and Settlement API

## Purpose

This runbook covers the first money-truth slice for withdrawals.

This slice lets the system move from:

- `broadcast`
- `confirmed`
- `settled`

and introduces:

- minimal withdrawal ledger journal posting
- ledger-backed balance reduction
- pending balance reduction on settlement

## Worker authentication

Worker endpoints require:

- `x-worker-api-key`
- `x-worker-id`

## List broadcast withdrawal intents

Endpoint:

    GET /transaction-intents/internal/worker/withdrawal-requests/broadcast?limit=20

Expected behavior:

- returns withdrawal intents with:
  - `status = broadcast`
  - `policyDecision = approved`
- includes latest blockchain transaction

## List confirmed withdrawal intents ready for settlement recovery

Endpoint:

    GET /transaction-intents/internal/worker/withdrawal-requests/confirmed-ready-to-settle?limit=20

Expected behavior:

- returns withdrawal intents with:
  - `status = confirmed`
  - `policyDecision = approved`
  - latest blockchain transaction status = `confirmed`
  - no existing `LedgerJournal`
- sorts oldest first
- lets the worker recover intents stranded after confirmation if a prior settle call failed or timed out

## Confirm a broadcast withdrawal intent

Endpoint:

    POST /transaction-intents/internal/worker/withdrawal-requests/:intentId/confirm

Example body:

    {
      "txHash": "0x1111111111111111111111111111111111111111111111111111111111111111"
    }

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
  - `AuditEvent.action = transaction_intent.withdrawal.confirmed`

## Settle a confirmed withdrawal intent

Endpoint:

    POST /transaction-intents/internal/worker/withdrawal-requests/:intentId/settle

Example body:

    {
      "note": "Confirmed withdrawal posted into ledger."
    }

Expected behavior:

- requires:
  - `status = confirmed`
  - `policyDecision = approved`
  - latest blockchain transaction status = `confirmed`
- creates one `LedgerJournal`
- creates two `LedgerPosting` rows:
  - debit customer liability
  - credit outbound clearing
- reduces `pendingBalance` by the settled amount
- keeps `availableBalance` unchanged because it was already reduced at request time
- updates:
  - `TransactionIntent.status = settled`
  - `TransactionIntent.settledAmount = requestedAmount`
- writes:
  - `AuditEvent.action = transaction_intent.withdrawal.settled`

## Success condition

A successful confirm-and-settle slice should produce:

- broadcast withdrawal intents moving into confirmed
- confirmed withdrawal intents moving into settled
- one ledger journal per settled withdrawal intent
- two ledger postings per settlement
- pending balance reduced to reflect the completed withdrawal
- durable ledger-backed withdrawal state
