# Account Hold Governance Reporting API

## Purpose

This slice upgrades oversight-driven account restriction into durable hold governance and reporting.

It adds:

- durable `CustomerAccountRestriction` history
- separate operator-role policy for placing and releasing holds
- caller-aware governance visibility in oversight workspace
- reporting APIs for active holds, released holds, and hold summary

This slice does not change transaction money-state behavior.

Deployment compatibility:

- existing snapshot-based holds are backfilled into `CustomerAccountRestriction`
- active holds remain releasable after the migration
- previously released holds become visible to released-hold reporting

## Authentication

These endpoints require:

- `x-operator-api-key`
- `x-operator-id`

Governed hold placement and release also require:

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

## Release account hold

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/release-account-hold

Example body:

    {
      "note": "Investigation complete. Hold can be removed."
    }

Expected behavior:

- requires an authorized release-role caller
- finds the active hold record for the same oversight incident and customer account
- updates that record to `status = released`
- stores release accountability metadata:
  - `releasedAt`
  - `releasedByOperatorId`
  - `releasedByOperatorRole`
  - `releaseNote`
  - `restoredStatus`
- restores `CustomerAccount.status` to `restrictedFromStatus` or `registered`
- writes `OversightIncidentEvent.eventType = account_restriction_released`
- writes `AuditEvent.action = customer_account.restriction_released`

## Active hold reporting

Endpoint:

    GET /oversight-incidents/internal/account-holds/active?limit=20

Supported filters:

- `incidentType`
- `restrictionReasonCode`
- `appliedByOperatorId`
- `email`

Expected behavior:

- returns active hold records newest first by `appliedAt`
- includes hold details, customer context, and linked oversight incident context

## Released hold reporting

Endpoint:

    GET /oversight-incidents/internal/account-holds/released?limit=20&sinceDays=30

Supported filters:

- `sinceDays`
- `incidentType`
- `restrictionReasonCode`
- `appliedByOperatorId`
- `releasedByOperatorId`
- `email`

Expected behavior:

- returns released hold records newest first by `releasedAt`
- includes both application and release accountability fields

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
