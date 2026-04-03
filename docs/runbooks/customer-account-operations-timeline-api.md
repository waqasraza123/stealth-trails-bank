# Customer Account Operations Timeline API

## Purpose

This runbook covers the first unified customer-account investigation chronology slice for operators.

This slice gives one timeline feed across:

- transaction intent creation
- manual resolution events
- review case events
- oversight incident events
- account hold apply and release events

It also returns:

- customer and account summary
- current restriction state
- key operational counts

This slice does not mutate money state.

## Authentication

These endpoints require:

- x-operator-api-key
- x-operator-id

## List customer account operations timeline

Endpoint:

GET /customer-account-operations/internal/timeline?customerAccountId=account_1&limit=50

Alternative lookup:

GET /customer-account-operations/internal/timeline?supabaseUserId=supabase_1&limit=50

At least one of these is required:

- customerAccountId
- supabaseUserId

## Supported filters

Optional filters:

- eventType
- actorId
- dateFrom
- dateTo
- limit

Example:

GET /customer-account-operations/internal/timeline?customerAccountId=account_1&eventType=review_case.note_added&actorId=ops_1&dateFrom=2026-04-01T00:00:00.000Z&dateTo=2026-04-03T00:00:00.000Z&limit=50

## Returned response shape

The response includes:

- summary
  - customer identity
  - current account status
  - current restriction state
  - operational counts
- timeline
  - normalized ordered feed entries newest first
- filters
  - normalized filter values actually applied

## Normalized event types

This slice currently emits these normalized event types:

- transaction_intent.created
- transaction_intent.manually_resolved
- review_case.opened
- review_case.started
- review_case.note_added
- review_case.handed_off
- review_case.account_release_requested
- review_case.account_release_approved
- review_case.account_release_denied
- review_case.manual_resolution_applied
- review_case.resolved
- review_case.dismissed
- oversight_incident.opened
- oversight_incident.started
- oversight_incident.note_added
- oversight_incident.account_restriction_applied
- oversight_incident.account_restriction_released
- oversight_incident.resolved
- oversight_incident.dismissed
- account_hold.applied
- account_hold.released

## Success condition

A successful account timeline slice should produce:

- one operator endpoint for customer-account chronology
- one normalized feed that no longer forces operators to manually correlate multiple modules
- enough linked narrative context to explain:
  - why a customer is restricted
  - what transaction activity happened
  - what review and oversight actions were taken
  - what operator touched the account and when
