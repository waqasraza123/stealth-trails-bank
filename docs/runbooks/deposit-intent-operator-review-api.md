# Deposit Intent Operator Review API

## Purpose

This runbook covers the internal operator review and decision slice for deposit transaction intents.

This slice lets internal operators:

- list pending deposit requests
- approve a pending deposit request
- deny a pending deposit request

It does not yet broadcast blockchain transactions and it does not settle ledger state yet.

## Internal operator authentication

The internal endpoints require these request headers:

- x-operator-api-key
- x-operator-id

The API key must match INTERNAL_OPERATOR_API_KEY.

The operator id is recorded in AuditEvent.actorId.

## List pending deposit requests

Endpoint:

~~~text
GET /transaction-intents/internal/deposit-requests/pending?limit=20
~~~

Expected behavior:

- returns pending deposit requests only
- filters to:
  - intentType = deposit
  - status = requested
  - policyDecision = pending
- sorts oldest first
- default limit is 20
- max limit is 100

## Approve a pending deposit request

Endpoint:

~~~text
POST /transaction-intents/internal/deposit-requests/:intentId/decision
~~~

Example body:

~~~json
{
  "decision": "approved",
  "note": "Deposit request approved."
}
~~~

Expected behavior:

- updates:
  - status = approved
  - policyDecision = approved
- clears failure fields
- writes an AuditEvent with:
  - actorType = operator
  - actorId = x-operator-id
  - action = transaction_intent.deposit.approved

## Deny a pending deposit request

Endpoint:

~~~text
POST /transaction-intents/internal/deposit-requests/:intentId/decision
~~~

Example body:

~~~json
{
  "decision": "denied",
  "denialReason": "Proof of funds missing.",
  "note": "Need supporting documents before approval."
}
~~~

Expected behavior:

- updates:
  - status = failed
  - policyDecision = denied
- sets:
  - failureCode = policy_denied
  - failureReason = denialReason
- writes an AuditEvent with:
  - actorType = operator
  - actorId = x-operator-id
  - action = transaction_intent.deposit.denied

## Failure modes

The request is rejected when:

- the operator API key is missing or invalid
- the operator id is missing
- the intent does not exist
- the intent is not a deposit intent on the product chain
- the intent is no longer pending operator decision
- a deny decision is submitted without a denial reason

## Success condition

A successful operator review path should produce:

- a visible pending queue
- one controlled state transition per intent
- one durable AuditEvent for the operator decision
- a clean handoff into the next execution slice
