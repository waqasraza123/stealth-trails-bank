# Review Case Manual Intervention API

## Purpose

This runbook covers the first explicit manual intervention execution slice from ReviewCase.

This slice lets operators:

- inspect whether a review case is eligible for manual resolution
- apply manual resolution to a linked transaction intent only when it is safe
- automatically resolve the review case as part of that action

This slice is intentionally conservative.

## Authentication

These endpoints require:

- x-operator-api-key
- x-operator-id

## Safety boundary

Manual resolution is allowed only when the linked transaction intent is already in a terminal non-money-truth runtime state.

In this slice that means:

- failed
- cancelled

Manual resolution is not allowed for:

- requested
- review_required
- approved
- queued
- broadcast
- confirmed
- settled

That means operators cannot use this endpoint to hide active runtime work, replayable work, or already-settled money states.

## Get manual resolution eligibility

Endpoint:

    GET /review-cases/internal/:reviewCaseId/manual-resolution-eligibility

Expected behavior:

- returns:
  - eligible
  - reasonCode
  - reason
  - currentIntentStatus
  - currentReviewCaseStatus
  - currentReviewCaseType
  - recommendedAction
- helps the operator understand whether:
  - manual resolution is safe
  - normal runtime flow should continue
  - the case should only be resolved or dismissed without intent mutation

## Apply manual resolution

Endpoint:

    POST /review-cases/internal/:reviewCaseId/apply-manual-resolution

Example body:

    {
      "manualResolutionReasonCode": "support_case_closed",
      "note": "Handled off-platform after customer support follow-up."
    }

Expected behavior:

- requires the review case to:
  - exist
  - not be dismissed
  - not already be resolved unless the state is already fully reused
- requires the linked transaction intent to be eligible
- requires the acting operator to own the case when it is already assigned and in_progress
- updates the linked transaction intent:
  - status = manually_resolved
  - manuallyResolvedAt
  - manualResolutionReasonCode
  - manualResolutionNote
- resolves the linked review case:
  - status = resolved
  - resolvedAt
  - assignedOperatorId set if needed
  - startedAt set if needed
- writes:
  - ReviewCaseEvent.eventType = manual_resolution_applied
  - ReviewCaseEvent.eventType = resolved
  - AuditEvent.action = transaction_intent.manually_resolved
  - AuditEvent.action = review_case.resolved

## Workspace visibility

The review case workspace now includes:

- manualResolutionEligibility

Endpoint:

    GET /review-cases/internal/:reviewCaseId/workspace?recentLimit=20

Expected behavior:

- lets the operator decide from the workspace whether:
  - manual resolution is safe
  - runtime flow should continue
  - the case should be resolved or dismissed without manual intervention

## Success condition

A successful manual intervention slice should produce:

- one safe, explicit path for operator manual resolution
- no dangerous shortcut around active runtime or settled money states
- stronger linkage between ReviewCase, TransactionIntent, and final operator outcome
- durable review-case and audit trails for manual intervention decisions
