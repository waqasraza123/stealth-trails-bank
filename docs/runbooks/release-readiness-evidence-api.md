# Release Readiness Evidence API

This runbook covers the durable Phase 12 evidence workflow for proving release readiness from both repo-owned verification suites and staging or production-like operational drills.

## Purpose

Use this API to record immutable proof for the current required checks:

- delivery-target SLO alerting
- critical alert re-escalation cadence
- database restore drill
- API rollback drill
- worker rollback drill
- contract invariant suite
- backend integration suite
- end-to-end finance flows
- secret handling review
- role review

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
- `contract_invariant_suite`
- `backend_integration_suite`
- `end_to_end_finance_flows`
- `secret_handling_review`
- `role_review`

## Environment values

- `development`
- `ci`
- `staging`
- `production_like`
- `production`

## Example

```json
{
  "evidenceType": "database_restore_drill",
  "environment": "production_like",
  "status": "passed",
  "releaseIdentifier": "launch-2026.04.08.1",
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

`GET /release-readiness/internal/summary` derives the current checkpoint from the latest accepted evidence for each required proof. When `releaseIdentifier` is supplied, the summary is scoped to that launch candidate so one release cannot inherit another release's proof.

- `healthy`: every required proof has a latest `passed` record
- `warning`: one or more proofs are still missing accepted evidence
- `critical`: the latest evidence for at least one required proof is `failed`

`GET /release-readiness/internal/evidence` also accepts an optional `releaseIdentifier` filter so operators can inspect the exact evidence set attached to one launch candidate.

## Launch rule

No launch posture is approved until the required proofs have accepted evidence in this workflow, the launch checklist attestations are complete, and the candidate has been approved through the governed launch-approval workflow.

## CLI helper

For staging or production-like drills, prefer the repo-owned probe runner:

```bash
pnpm release:readiness:probe -- --help
```

The command validates the relevant operator endpoints for a chosen evidence type, prints structured JSON proof, and can persist that result through `POST /release-readiness/internal/evidence` when `--record-evidence` is supplied.

For repo-owned verification suites and manual review attestations, use:

```bash
pnpm release:readiness:verify -- --help
```

That command runs the automated Phase 12 proof suites, supports manual secret or role review attestations, prints structured JSON proof, and can persist each result through the same evidence API.

## Launch-closure pack

For the remaining staging-like Phase 12 work, prefer the repo-owned launch-closure helper:

```bash
pnpm release:launch-closure -- status
pnpm release:launch-closure -- validate --manifest ./launch-manifest.json
pnpm release:launch-closure -- scaffold --manifest ./launch-manifest.json --output-dir ./artifacts/release-launch/current --force
```

That helper does not close evidence gates. It validates required inputs, generates a strict execution pack, and preserves the distinction between:

- repo-owned proofs already satisfiable from development or ci
- local dry-run support that is still not accepted launch proof
- external-only accepted proofs that require `staging`, `production_like`, or `production`

See [`docs/runbooks/phase-12-launch-closure.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/phase-12-launch-closure.md).
