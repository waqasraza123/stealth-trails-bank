# Account Hold Governance Reporting API

## Purpose

This slice upgrades oversight-driven account restriction into durable hold governance and reporting.

It adds:

- durable `CustomerAccountRestriction` history
- separate operator-role policy for placing holds and deciding release approvals
- caller-aware governance visibility in oversight workspace
- explicit release-review workflow and pending release queue
- reporting APIs for active holds, released holds, and hold summary

This slice does not change transaction money-state behavior.

Deployment compatibility:

- existing snapshot-based holds are backfilled into `CustomerAccountRestriction`
- active holds remain review-releasable after the migration
- previously released holds become visible to released-hold reporting

## Authentication

These endpoints require:

- `x-operator-api-key`
- `x-operator-id`

Governed hold placement and release-approval decisions also require:

- `x-operator-role`

## Runtime policy

Runtime config:

- `ACCOUNT_HOLD_APPLY_ALLOWED_OPERATOR_ROLES`
- `ACCOUNT_HOLD_RELEASE_ALLOWED_OPERATOR_ROLES`

Default apply roles:

- `operations_admin`
- `risk_manager`

Default release roles:

- `operations_admin`
- `risk_manager`
- `compliance_lead`

Unauthorized callers receive `403 Forbidden`.

## Oversight workspace governance visibility

Endpoint:

    GET /oversight-incidents/internal/:oversightIncidentId/workspace?recentLimit=20

Workspace now includes `accountHoldGovernance` with:

- `operatorRole`
- `canApplyAccountHold`
- `canReleaseAccountHold`
- `allowedApplyOperatorRoles`
- `allowedReleaseOperatorRoles`

The `canApplyAccountHold` and `canReleaseAccountHold` booleans reflect both caller role policy and current incident/account state.

## Place account hold

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/place-account-hold

Example body:

    {
      "restrictionReasonCode": "oversight_risk_hold",
      "note": "Placing temporary hold pending investigation."
    }

Expected behavior:

- requires a customer-account oversight incident
- requires an authorized apply-role caller
- creates a durable `CustomerAccountRestriction` record with `status = active`
- updates `CustomerAccount` current-state restriction snapshot
- writes `OversightIncidentEvent.eventType = account_restriction_applied`
- writes `AuditEvent.action = customer_account.restricted`

## Request account release

Endpoint:

    POST /review-cases/internal/:reviewCaseId/request-account-release

Example body:

    {
      "note": "Investigation complete. Requesting release approval."
    }

Expected behavior:

- requires the linked `account_review` review case
- requires the linked restriction record to still be active
- updates the restriction record to `releaseDecisionStatus = pending`
- stores release request metadata
- writes `ReviewCaseEvent.eventType = account_release_requested`
- writes `AuditEvent.action = customer_account.release_review_requested`

## Pending release review queue

Endpoint:

    GET /review-cases/internal/account-release-requests/pending

Expected behavior:

- returns pending release requests newest first by `releaseRequestedAt`
- includes linked review case summary, customer context, hold metadata, and incident metadata

## Decide account release

Endpoint:

    POST /review-cases/internal/account-release-requests/:reviewCaseId/decision

Example body:

    {
      "decision": "approved",
      "note": "Hold can be removed."
    }

Expected behavior:

- requires an authorized release-role caller
- requires a pending release request on the linked active hold
- approved decisions:
  - update the hold record to `status = released`
  - store release accountability metadata
  - restore `CustomerAccount.status` to `restrictedFromStatus` or `registered`
  - resolve the linked review case
  - write `ReviewCaseEvent.eventType = account_release_approved`
  - write `ReviewCaseEvent.eventType = resolved`
  - write `OversightIncidentEvent.eventType = account_restriction_released`
  - write `AuditEvent.action = customer_account.restriction_released`
- denied decisions:
  - keep the hold active
  - update `releaseDecisionStatus = denied`
  - keep the linked review case active or in progress
  - write `ReviewCaseEvent.eventType = account_release_denied`
  - write `AuditEvent.action = customer_account.release_review_denied`

## Active hold reporting

Endpoint:

    GET /oversight-incidents/internal/account-holds/active?limit=20

Supported filters:

- `incidentType`
- `restrictionReasonCode`
- `appliedByOperatorId`
- `releaseDecisionStatus`
- `email`

Expected behavior:

- returns active hold records newest first by `appliedAt`
- includes hold details, customer context, linked oversight incident context, and release-review state

## Released hold reporting

Endpoint:

    GET /oversight-incidents/internal/account-holds/released?limit=20&sinceDays=30

Supported filters:

- `sinceDays`
- `incidentType`
- `restrictionReasonCode`
- `appliedByOperatorId`
- `releasedByOperatorId`
- `releaseDecisionStatus`
- `email`

Expected behavior:

- returns released hold records newest first by `releasedAt`
- includes both application and release accountability fields, decision metadata, and hold duration

## Hold summary

Endpoint:

    GET /oversight-incidents/internal/account-holds/summary?sinceDays=30

Summary returns:

- `totalHolds`
- `activeHolds`
- `releasedHolds`
- `byIncidentType`
- `byReasonCode`
- `byAppliedOperator`
- `byReleasedOperator`

When `sinceDays` is provided, the summary includes holds applied or released within that window.
