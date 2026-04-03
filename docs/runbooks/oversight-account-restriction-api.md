# Oversight Account Restriction API

## Purpose

This runbook covers the restricted-account hold lifecycle driven by oversight incidents and the linked release-review workflow.

This slice lets operators:

- place a temporary risk hold on a customer account from an oversight incident
- automatically link that hold to an `account_review` review case
- request release from the linked review case
- review pending release requests in a queue
- approve or deny release with a privileged operator role
- report active holds, released holds, and hold summaries

It still blocks new deposit and withdrawal requests while a hold is active.

## Authentication

These endpoints require:

- `x-operator-api-key`
- `x-operator-id`

Release-approval decisions also require an operator role that is allowed by the account-hold release runtime policy.

## Place an account hold from an oversight incident

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/place-account-hold

Example body:

    {
      "restrictionReasonCode": "oversight_risk_hold",
      "note": "Repeated manual interventions require temporary containment."
    }

Expected behavior:

- allowed only when the oversight incident:
  - exists
  - is not resolved
  - is not dismissed
  - targets a customer account
- allowed only when the target account is not already restricted by another active hold
- updates the customer account:
  - `status = restricted`
  - `restrictedAt`
  - `restrictedFromStatus`
  - `restrictionReasonCode`
  - `restrictedByOperatorId`
  - `restrictedByOversightIncidentId`
- creates a durable `CustomerAccountRestriction` record
- opens or reuses a linked `ReviewCase` of type `account_review`
- stores the linked review case id on `CustomerAccountRestriction.releaseReviewCaseId`
- writes:
  - `OversightIncidentEvent.eventType = account_restriction_applied`
  - `AuditEvent.action = customer_account.restricted`

## Request account release from the linked review case

Endpoint:

    POST /review-cases/internal/:reviewCaseId/request-account-release

Example body:

    {
      "note": "Investigation is complete. Requesting release approval."
    }

Expected behavior:

- allowed only for a linked `account_review` review case
- allowed only while the linked restriction record is still active
- updates the restriction record:
  - `releaseDecisionStatus = pending`
  - `releaseRequestedAt`
  - `releaseRequestedByOperatorId`
  - `releaseRequestNote`
- writes:
  - `ReviewCaseEvent.eventType = account_release_requested`
  - `AuditEvent.action = customer_account.release_review_requested`

## Pending account release queue

Endpoint:

    GET /review-cases/internal/account-release-requests/pending

Expected behavior:

- returns pending account release reviews
- includes:
  - linked review case summary
  - customer identity
  - oversight incident summary
  - hold metadata
  - release request metadata

## Decide an account release request

Endpoint:

    POST /review-cases/internal/account-release-requests/:reviewCaseId/decision

Example body:

    {
      "decision": "approved",
      "note": "Release approved after oversight review."
    }

Decision behavior:

- role-gated by the account-hold release runtime policy
- requires a pending release request on the linked active restriction record

When `decision = approved`:

- releases the active restriction record
- restores the customer account back to `previousStatus`, or `registered` if absent
- resolves the linked review case
- writes:
  - `ReviewCaseEvent.eventType = account_release_approved`
  - `ReviewCaseEvent.eventType = resolved`
  - `OversightIncidentEvent.eventType = account_restriction_released`
  - `AuditEvent.action = customer_account.restriction_released`
  - `AuditEvent.action = review_case.resolved`

When `decision = denied`:

- keeps the restriction active
- sets the release decision state to denied
- keeps the linked review case open or in progress
- writes:
  - `ReviewCaseEvent.eventType = account_release_denied`
  - `AuditEvent.action = customer_account.release_review_denied`

## Hold reporting APIs

Active holds:

    GET /oversight-incidents/internal/account-holds/active

Released holds:

    GET /oversight-incidents/internal/account-holds/released

Summary:

    GET /oversight-incidents/internal/account-holds/summary

Active reporting returns:

- customer identity
- current account status
- oversight incident summary
- applied operator accountability
- release review state
- linked review case id

Released reporting returns:

- customer identity
- oversight incident summary
- applied and released operator accountability
- release review decision metadata
- hold duration

Summary returns:

- `totalHolds`
- `activeHolds`
- `releasedHolds`
- `byIncidentType`
- `byReasonCode`
- `byAppliedOperator`
- `byReleasedOperator`

## Sensitive request blocking

While a customer account is under an active risk hold:

- `POST /transaction-intents/deposit-requests` is rejected
- `POST /transaction-intents/withdrawal-requests` is rejected

Expected behavior:

- blocked accounts cannot create new sensitive transaction-intent requests
- error indicates the account is under a risk hold

## Success condition

A successful restricted-account release-review slice should produce:

- durable hold history across multiple hold and release cycles
- explicit release-review workflow instead of direct hold release
- privileged approval and denial controls
- durable active and released hold reporting
- summary reporting across incident type, reason code, applier, and releaser
- continued prevention of new sensitive transaction-intent requests while a hold is active
