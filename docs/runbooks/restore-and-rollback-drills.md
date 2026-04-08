# Restore And Rollback Drills

## Purpose

This runbook defines the minimum Phase 12 drills required before any real launch posture:
- database restore drill
- API rollback drill
- worker rollback drill
- post-rollback validation

## Drill 1: Database restore

Goal:
- prove a recent PostgreSQL backup can be restored into a clean environment without data-shape surprises

Required inputs:
- latest production-like backup
- matching migration history
- isolated restore environment

Procedure:
1. provision a clean PostgreSQL instance
2. restore the captured backup
3. point `DATABASE_URL` and `DIRECT_URL` at the restored instance
4. run Prisma generation and confirm the schema loads cleanly
5. start the API against the restored environment
6. validate:
   - auth endpoints start
   - review queues load
   - reconciliation runs load
   - operations monitoring status loads
   - latest incident package release records load

Success criteria:
- API boots without schema drift or missing-table failures
- core customer, operator, ledger, and monitoring reads work

## Drill 2: API rollback

Goal:
- prove the currently deployed API can be replaced with the prior release without leaving the service in an unknown state

Procedure:
1. capture the current release identifier
2. deploy the previous known-good API image or artifact
3. keep the database at the current migration state unless the release process explicitly supports schema rollback
4. confirm:
   - API health and startup complete
   - auth works
   - operator monitoring endpoints work
   - no migration step is implicitly required at runtime

Success criteria:
- previous API version serves read and guarded write paths that remain compatible with the current schema

## Drill 3: Worker rollback

Goal:
- prove worker execution can be safely downgraded without replay corruption

Procedure:
1. stop the current worker runtime
2. deploy the previous worker release
3. confirm:
   - heartbeat reporting resumes
   - queue pickup resumes in the expected execution mode
   - operations monitoring shows fresh worker health
   - no duplicate broadcast or settlement transition occurs for queued intents

Success criteria:
- worker resumes safely and monitoring reflects the reverted version within the stale threshold

## Post-drill validation

After each drill validate:
- open platform alerts match expected conditions
- no new critical reconciliation mismatch appears
- no unresolved failed scan remains from the drill
- operator console still loads review, oversight, and release queues

## Evidence to capture

- backup identifier or snapshot reference
- release identifiers used for rollback
- exact timestamps for restore and rollback completion
- operator performing the drill
- screenshots or API responses for post-drill validation
- discovered gaps and remediation owner

## Durable evidence recording

After each staging or production-like drill, record the outcome through the release-readiness API:

- `POST /release-readiness/internal/evidence`
- use `evidenceType=database_restore_drill`, `api_rollback_drill`, or `worker_rollback_drill`
- set `environment` to `staging`, `production_like`, or `production`
- include the release id, rollback release id, backup reference, evidence links, and structured payload for the exact validation steps that were run

The launch checklist is not complete until that durable evidence exists.

After the evidence is recorded, request governed launch approval through:

- `POST /release-readiness/internal/approvals`
- include the release identifier, rollback release identifier, checklist attestations, and any open blockers
- approval remains blocked until all required proof types show a latest `passed` record and checklist blockers are cleared

## Drill runner

Use the executable runner to capture the post-drill validation payload and optionally record evidence immediately:

Database restore:

```bash
pnpm release:readiness:probe -- \
  --probe database_restore_drill \
  --base-url https://restore-api.example.com \
  --operator-id ops_stage_1 \
  --api-key "$INTERNAL_OPERATOR_API_KEY" \
  --operator-role operations_admin \
  --environment production_like \
  --release-id api-2026.04.08.1 \
  --backup-ref snapshot-2026-04-08T09:00Z \
  --record-evidence
```

API rollback:

```bash
pnpm release:readiness:probe -- \
  --probe api_rollback_drill \
  --base-url https://staging-api.example.com \
  --operator-id ops_stage_1 \
  --api-key "$INTERNAL_OPERATOR_API_KEY" \
  --operator-role operations_admin \
  --environment production_like \
  --release-id api-2026.04.08.1 \
  --rollback-release-id api-2026.04.07.3 \
  --record-evidence
```

Worker rollback:

```bash
pnpm release:readiness:probe -- \
  --probe worker_rollback_drill \
  --base-url https://staging-api.example.com \
  --operator-id ops_stage_1 \
  --api-key "$INTERNAL_OPERATOR_API_KEY" \
  --operator-role operations_admin \
  --expected-worker-id worker-staging-1 \
  --expected-min-healthy-workers 1 \
  --environment production_like \
  --release-id worker-2026.04.08.1 \
  --rollback-release-id worker-2026.04.07.3 \
  --record-evidence
```

## Launch rule

No launch posture is approved until these drills have been run against production-like infrastructure and the evidence is attached to the launch checklist.
