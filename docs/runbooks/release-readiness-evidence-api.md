# Release Readiness Evidence API

This runbook covers the durable Phase 12 evidence workflow for proving release readiness against staging or production-like traffic.

## Purpose

Use this API to record immutable proof for the current required checks:

- delivery-target SLO alerting
- critical alert re-escalation cadence
- database restore drill
- API rollback drill
- worker rollback drill

The goal is to replace ad hoc screenshots and scattered notes with a durable operator-visible evidence trail.

## Endpoints

- `GET /release-readiness/internal/summary`
- `GET /release-readiness/internal/evidence`
- `GET /release-readiness/internal/evidence/:evidenceId`
- `POST /release-readiness/internal/evidence`
- `GET /release-readiness/internal/approvals`
- `GET /release-readiness/internal/approvals/:approvalId`
- `POST /release-readiness/internal/approvals`
- `POST /release-readiness/internal/approvals/:approvalId/approve`
- `POST /release-readiness/internal/approvals/:approvalId/reject`

Required operator headers:

- `x-operator-api-key`
- `x-operator-id`
- optional `x-operator-role`

## Evidence payload

Required fields for `POST /release-readiness/internal/evidence`:

- `evidenceType`
- `environment`
- `status`
- `summary`

Optional fields:

- `releaseIdentifier`
- `rollbackReleaseIdentifier`
- `backupReference`
- `note`
- `evidenceLinks`
- `evidencePayload`
- `startedAt`
- `completedAt`
- `observedAt`

## Evidence types

- `platform_alert_delivery_slo`
- `critical_alert_reescalation`
- `database_restore_drill`
- `api_rollback_drill`
- `worker_rollback_drill`

## Example

```json
{
  "evidenceType": "database_restore_drill",
  "environment": "production_like",
  "status": "passed",
  "releaseIdentifier": "api-2026.04.08.1",
  "backupReference": "snapshot-2026-04-08T09:00Z",
  "summary": "Restored the latest production-like backup and verified auth, review, reconciliation, operations status, and incident package reads.",
  "note": "No missing-table or schema-drift issues were observed.",
  "evidenceLinks": [
    "https://evidence.example.com/restore-drill/2026-04-08"
  ],
  "evidencePayload": {
    "validatedEndpoints": [
      "/auth/login",
      "/operations/internal/status",
      "/ledger/internal/reconciliation/runs"
    ],
    "postDrillAlerts": {
      "unexpectedCriticalCount": 0
    }
  }
}
```

## Summary behavior

`GET /release-readiness/internal/summary` derives the current checkpoint from the latest accepted evidence for each required proof.

- `healthy`: every required proof has a latest `passed` record
- `warning`: one or more proofs are still missing accepted evidence
- `critical`: the latest evidence for at least one required proof is `failed`

## Launch rule

No launch posture is approved until the required proofs have accepted evidence in this workflow, the launch checklist attestations are complete, and the candidate has been approved through the governed launch-approval workflow.

## CLI helper

For staging or production-like drills, prefer the repo-owned runner:

```bash
pnpm release:readiness:probe -- --help
```

The command validates the relevant operator endpoints for a chosen evidence type, prints structured JSON proof, and can persist that result through `POST /release-readiness/internal/evidence` when `--record-evidence` is supplied.
