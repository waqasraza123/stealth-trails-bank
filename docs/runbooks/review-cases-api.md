# Review Cases API

## Purpose

This runbook covers the first runtime adoption slice for `ReviewCase`.

This slice lets operators:

- open explicit review cases for reconciliation states that require manual review
- open explicit review cases for denied withdrawal intents when follow-up is needed
- list and inspect review cases
- resolve or dismiss review cases

This slice does not mutate money state directly.

## Authentication

These endpoints require:

- `Authorization: Bearer <operator-session-token>`

## Open a deposit reconciliation review case

Endpoint:

    POST /transaction-intents/internal/reconciliation/deposit-settlements/:intentId/open-review-case

Example body:

    {
      "note": "Mismatch needs operator investigation."
    }

Expected behavior:

- allowed only when the deposit reconciliation state is `manual_review_required`
- opens or reuses a `ReviewCase` with:
  - `type = reconciliation_review`
  - `status = open`
- links the case to:
  - customer
  - customer account
  - transaction intent
- writes an audit event for review-case opening

## Open a withdrawal reconciliation review case

Endpoint:

    POST /transaction-intents/internal/reconciliation/withdrawal-settlements/:intentId/open-review-case

Example body:

    {
      "note": "Withdrawal settlement inconsistency needs manual review."
    }

Expected behavior:

- allowed only when the withdrawal reconciliation state is `manual_review_required`
- opens or reuses a `ReviewCase` with:
  - `type = reconciliation_review`
  - `status = open`

## Open a denied withdrawal review case

Endpoint:

    POST /review-cases/internal/withdrawal-intents/:intentId/open

Example body:

    {
      "note": "Customer support follow-up is needed.",
      "reasonCode": "customer_follow_up_required"
    }

Expected behavior:

- allowed only when the withdrawal intent is:
  - `intentType = withdrawal`
  - `status = failed`
  - `policyDecision = denied`
- opens or reuses a `ReviewCase` with:
  - `type = withdrawal_review`
  - `status = open`

## List review cases

Endpoint:

    GET /review-cases/internal?status=open&type=reconciliation_review&limit=20

Expected behavior:

- returns newest updated first
- supports filters by:
  - `status`
  - `type`
  - `customerAccountId`
  - `transactionIntentId`

## Get one review case

Endpoint:

    GET /review-cases/internal/:reviewCaseId

Expected behavior:

- returns linked customer, customer account, and transaction intent context when present

## Resolve a review case

Endpoint:

    POST /review-cases/internal/:reviewCaseId/resolve

Example body:

    {
      "note": "Issue was investigated and resolved."
    }

Expected behavior:

- moves:
  - `status = resolved`
- writes an audit event
- reuses the state safely if already resolved

## Dismiss a review case

Endpoint:

    POST /review-cases/internal/:reviewCaseId/dismiss

Example body:

    {
      "note": "No further action is needed."
    }

Expected behavior:

- moves:
  - `status = dismissed`
- writes an audit event
- reuses the state safely if already dismissed

## Success condition

A successful review-case slice should produce:

- a real operator case queue
- explicit case creation for manual-review-only reconciliation states
- optional case creation for denied withdrawals that need follow-up
- durable review-case lifecycle auditability
- no need to manage manual investigations only through raw audit events or direct database access
