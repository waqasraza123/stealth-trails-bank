# Oversight Incidents API

## Purpose

This runbook covers the first operator oversight escalation slice for manual intervention patterns.

This slice lets operators:

- inspect alert-style signals for suspicious manual intervention patterns
- open explicit oversight incidents when thresholds are exceeded
- investigate oversight incidents in a dedicated workspace
- assign, note, resolve, or dismiss oversight incidents

This slice does not mutate money state directly.

## Authentication

These endpoints require:

- x-operator-api-key
- x-operator-id

## Alert detection

Endpoint:

    GET /oversight-incidents/internal/alerts?sinceDays=30&customerThreshold=2&operatorThreshold=3&limit=20

Optional filter:

- incidentType

Returned alert types:

- customer_manual_resolution_spike
- operator_manual_resolution_spike

Expected behavior:

- scans manually resolved intents on the product chain within the requested time window
- groups them by:
  - customer account
  - manual resolver operator id
- flags subjects whose counts exceed the configured threshold
- indicates whether an open or in-progress oversight incident already exists
- recommends either:
  - open_incident
  - monitor_existing_incident

## Open a customer oversight incident

Endpoint:

    POST /oversight-incidents/internal/customer/:customerAccountId/open

Example body:

    {
      "sinceDays": 30,
      "threshold": 2,
      "note": "Repeated manual resolutions need oversight review."
    }

Expected behavior:

- allowed only when the customer manual-resolution count meets or exceeds the threshold
- opens or reuses an incident with:
  - incidentType = customer_manual_resolution_spike
  - status = open

## Open an operator oversight incident

Endpoint:

    POST /oversight-incidents/internal/operator/:subjectOperatorId/open

Example body:

    {
      "sinceDays": 30,
      "threshold": 3,
      "note": "Operator manual-resolution volume needs oversight review."
    }

Expected behavior:

- allowed only when the operator manual-resolution count meets or exceeds the threshold
- opens or reuses an incident with:
  - incidentType = operator_manual_resolution_spike
  - status = open

## List oversight incidents

Endpoint:

    GET /oversight-incidents/internal?status=open&incidentType=customer_manual_resolution_spike&limit=20

Useful filters:

- status
- incidentType
- assignedOperatorId
- subjectCustomerAccountId
- subjectOperatorId
- email
- reasonCode

## Get one oversight incident

Endpoint:

    GET /oversight-incidents/internal/:oversightIncidentId

## Get oversight incident workspace

Endpoint:

    GET /oversight-incidents/internal/:oversightIncidentId/workspace?recentLimit=20

Expected behavior:

- returns:
  - oversight incident details
  - ordered oversight incident event timeline
  - recent manually resolved intents for the subject
  - recent related review cases for the subject

## Start an oversight incident

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/start

Example body:

    {
      "note": "Taking ownership of this oversight incident."
    }

Expected behavior:

- moves:
  - status = in_progress
- sets:
  - assignedOperatorId = x-operator-id
  - startedAt if it was not already set

## Add an oversight incident note

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/notes

Example body:

    {
      "note": "Recent interventions appear concentrated in one operator workflow."
    }

## Resolve an oversight incident

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/resolve

Example body:

    {
      "note": "Oversight review completed and no further action is required."
    }

## Dismiss an oversight incident

Endpoint:

    POST /oversight-incidents/internal/:oversightIncidentId/dismiss

Example body:

    {
      "note": "Pattern was expected during the migration period."
    }

## Success condition

A successful oversight escalation slice should produce:

- explicit alerts for suspicious manual intervention patterns
- durable oversight incidents for repeated manual resolution spikes
- one operator workspace for investigating those patterns
- no need to track oversight concerns only through raw summary data or ad hoc spreadsheets
