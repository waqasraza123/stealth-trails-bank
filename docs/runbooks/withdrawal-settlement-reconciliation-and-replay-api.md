# Withdrawal Settlement Reconciliation and Replay API

## Purpose

This runbook covers the first operator-facing reconciliation and safe replay slice for withdrawal settlement.

This slice lets operators:

- inspect withdrawal settlement health
- identify safe confirm replay cases
- identify safe settle replay cases
- replay those missed transitions without manual SQL

It does not auto-repair manual-review-only cases.

## Authentication

These endpoints require:

- `x-operator-api-key`
- `x-operator-id`

## List withdrawal settlement reconciliation

Endpoint:

    GET /transaction-intents/internal/reconciliation/withdrawal-settlements?limit=20

Optional state filter:

    GET /transaction-intents/internal/reconciliation/withdrawal-settlements?state=ready_for_settle_replay

Returned states:

- `waiting_for_confirmation`
- `ready_for_confirm_replay`
- `ready_for_settle_replay`
- `healthy_settled`
- `manual_review_required`

Expected behavior:

- inspects withdrawal intents on the product chain in:
  - `broadcast`
  - `confirmed`
  - `settled`
- checks latest blockchain transaction
- checks ledger journal presence
- checks settled amount consistency
- returns summary counts and detailed items

## Replay confirm

Endpoint:

    POST /transaction-intents/internal/reconciliation/withdrawal-settlements/:intentId/replay-confirm

Example body:

    {
      "note": "Replay missed confirm after worker partial failure."
    }

Expected behavior:

- allowed only when reconciliation state is `ready_for_confirm_replay`
- reuses the existing confirm runtime path
- writes audit metadata showing:
  - `reconciliationReplay = true`
  - `replayReason = withdrawal_settlement_reconciliation`

## Replay settle

Endpoint:

    POST /transaction-intents/internal/reconciliation/withdrawal-settlements/:intentId/replay-settle

Example body:

    {
      "note": "Replay missed settle after ledger write interruption."
    }

Expected behavior:

- allowed only when reconciliation state is `ready_for_settle_replay`
- reuses the existing settle runtime path
- writes audit metadata showing:
  - `reconciliationReplay = true`
  - `replayReason = withdrawal_settlement_reconciliation`
- if the targeted reconciliation scan confirms the mismatch is gone, any linked open `reconciliation_review` case is automatically resolved with matching audit trail

## Manual review cases

These remain manual review:

- missing blockchain transaction
- unexpected policy decision
- ledger journal present before expected status
- settled intent without ledger journal
- settled amount mismatch
- confirmed or settled intent without confirmed blockchain transaction

## Success condition

A successful reconciliation slice should produce:

- clear operator visibility into withdrawal settlement health
- safe replay for confirm gaps
- safe replay for settlement gaps
- no direct database edits for auto-recoverable cases
- durable replay audit trail
