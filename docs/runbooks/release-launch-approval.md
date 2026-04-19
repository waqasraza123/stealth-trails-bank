# Release Launch Approval

## Purpose

This runbook defines the governed Phase 12 launch gate that sits on top of release-readiness evidence.

Use it when a release candidate has collected its staging or production-like evidence and is ready for explicit operator approval or rejection.

## Endpoints

- `GET /release-readiness/internal/approvals`
- `GET /release-readiness/internal/approvals/:approvalId`
- `POST /release-readiness/internal/approvals`
- `POST /release-readiness/internal/approvals/:approvalId/approve`
- `POST /release-readiness/internal/approvals/:approvalId/reject`

Required operator authentication:

- `Authorization: Bearer <operator-session-token>`

## Requesting approval

`GET /release-readiness/internal/approvals` accepts the same bounded filters used by the operator console, including an exact `releaseIdentifier` match for one launch candidate.

`POST /release-readiness/internal/approvals` records:

- release identifier
- environment
- rollback release identifier
- launch summary
- checklist attestations for:
  - security configuration
  - access and governance
  - data and recovery
  - platform health
  - functional proof
  - contract and chain proof
  - final sign-off
  - residual risk acceptance
- open blockers
- residual risk note

The service snapshots the latest release-readiness evidence state and computes whether the request is actually eligible for approval.

Request policy:

- only configured launch-request roles may create approval requests
- rollback release identifier is required for every governed launch request
- the requester cannot later approve or reject the same launch request
- the approval gate records stale evidence separately from missing or failed evidence
- the approval gate blocks if rollback drill evidence targets a different rollback release than the request

## Approval rule

`POST /release-readiness/internal/approvals/:approvalId/approve` succeeds only when:

- every required release-readiness proof has a latest `passed` record
- every required `passed` proof is still fresh enough for the configured maximum evidence age
- rollback drill evidence metadata matches the requested rollback release identifier
- every checklist attestation is complete
- no open blockers remain

If any of those conditions are false, the approval stays blocked and the endpoint rejects the action.

## Rejection rule

`POST /release-readiness/internal/approvals/:approvalId/reject` records a durable rejection with a required rejection note and the current blocker snapshot.

The requester cannot reject their own launch request; rejection follows the same dual-control rule as approval.

## Launch rule

No launch posture is approved until:

- required evidence is recorded
- the checklist is explicitly attested
- the governed launch-approval record is approved
