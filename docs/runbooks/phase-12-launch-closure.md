# Phase 12 Launch Closure

## Purpose

This runbook freezes the remaining launch work into a single governed operator program.

Use it when the repo is already code-verified and the remaining work is no longer feature delivery, but accepted operational proof, human review evidence, and dual-control launch approval.

This runbook does not mark release readiness complete by itself. It exists to make staging-like execution strict, repeatable, and auditable.

## Current truth

Already satisfied from repo-owned work:

- `contract_invariant_suite` can be accepted from repo-owned automation
- `backend_integration_suite` can be accepted from repo-owned automation
- `end_to_end_finance_flows` can be accepted from repo-owned automation, and staging-like reruns can append live smoke through the same verifier
- local dry-run support already exists for `database_restore_drill`, `api_rollback_drill`, and `worker_rollback_drill`

Still externally required:

- `platform_alert_delivery_slo`
- `critical_alert_reescalation`
- `database_restore_drill` in `staging`, `production_like`, or `production`
- `api_rollback_drill` in `staging`, `production_like`, or `production`
- `worker_rollback_drill` in `staging`, `production_like`, or `production`
- `secret_handling_review`
- `role_review`
- final governed launch approval

Important truth:

- local dry-runs are diagnostic support only
- staging-like `end_to_end_finance_flows` reruns require live Playwright smoke configuration to count as accepted operational proof in that environment
- accepted proof for the remaining operational items must come from `staging`, `production_like`, or `production`
- launch approval is blocked until every required proof has current accepted evidence and every checklist attestation is complete

## Required inputs before execution starts

The team must complete a validated manifest before any staging-like execution begins.

Use:

- [`docs/templates/release-launch-closure/environment-manifest.template.json`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/templates/release-launch-closure/environment-manifest.template.json)
- `pnpm release:launch-closure -- validate --manifest <path>`

Required input classes:

- release identifier
- accepted environment label
- web, admin, API, and restore-validation API base URLs
- live smoke URLs and credentials when rerunning `end_to_end_finance_flows` in `staging`, `production_like`, or `production`
- worker identifier
- requester and approver identities
- requester and approver roles
- operator API key environment variable name
- current release ids and rollback release ids
- backup or snapshot reference
- alert delivery target name and expected degraded health status
- critical alert identifier or dedupe key
- minimum expected re-escalation count
- secret review references
- role review references
- approved role roster reference

Execution must not start if:

- requester and approver are the same person
- the environment is `development` or `ci`
- rollback identifiers are missing
- backup reference is missing
- no critical alert identifier or dedupe key is available for re-escalation proof

## Operator program

### Roles

- requester: runs probes, collects evidence, submits the launch approval request
- approver: independently approves or rejects the governed launch request
- secret reviewer: owns the secret-handling review evidence
- access reviewer: owns the operator roster and role review evidence

The requester and approver must be different identities.

## Execution sequence

Run the remaining accepted proofs in this order:

1. `platform_alert_delivery_slo`
2. `critical_alert_reescalation`
3. `database_restore_drill`
4. `api_rollback_drill`
5. `worker_rollback_drill`
6. `secret_handling_review`
7. `role_review`
8. final governed launch approval

Why this order:

- alerting proof validates operator visibility before rollback work starts
- restore and rollback drills validate recovery posture before approval is requested
- manual reviews stay late so they reference the final launch candidate and operator roster
- approval stays last so it snapshots the current evidence set instead of an earlier incomplete state

## Exact staging-like execution flow

### 1. Validate the manifest

```bash
pnpm release:launch-closure -- validate --manifest ./launch-manifest.json
```

### 2. Generate the launch-closure pack

```bash
pnpm release:launch-closure -- scaffold --manifest ./launch-manifest.json --output-dir ./artifacts/release-launch/current --force
```

The generated pack contains:

- execution plan
- local-versus-accepted truth summary
- approval request body template
- one evidence template per remaining Phase 12 item

### 3. Run the staging-like probes

Alert delivery SLO:

```bash
pnpm release:readiness:probe -- \
  --probe platform_alert_delivery_slo \
  --base-url https://staging-api.example.com \
  --operator-id ops_stage_1 \
  --api-key "$INTERNAL_OPERATOR_API_KEY" \
  --operator-role operations_admin \
  --expected-target-name ops-critical \
  --expected-target-health-status critical \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --record-evidence
```

Critical alert re-escalation:

```bash
pnpm release:readiness:probe -- \
  --probe critical_alert_reescalation \
  --base-url https://staging-api.example.com \
  --operator-id ops_stage_1 \
  --api-key "$INTERNAL_OPERATOR_API_KEY" \
  --operator-role operations_admin \
  --expected-alert-id alert_123 \
  --expected-min-re-escalations 1 \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --record-evidence
```

Database restore:

```bash
pnpm release:readiness:probe -- \
  --probe database_restore_drill \
  --base-url https://restore-api.example.com \
  --operator-id ops_stage_1 \
  --api-key "$INTERNAL_OPERATOR_API_KEY" \
  --operator-role operations_admin \
  --environment production_like \
  --release-id launch-2026.04.10.1 \
  --backup-ref snapshot-2026-04-10T08:00Z \
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
  --release-id launch-2026.04.10.1 \
  --rollback-release-id api-2026.04.09.4 \
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
  --release-id launch-2026.04.10.1 \
  --rollback-release-id worker-2026.04.09.4 \
  --record-evidence
```

### 4. Record the manual review evidence

Secret handling review:

```bash
pnpm release:readiness:verify -- \
  --proof secret_handling_review \
  --environment production_like \
  --summary "Launch secret handling reviewed for launch-2026.04.10.1." \
  --note "Reference: ticket/SEC-42" \
  --evidence-links ticket/SEC-42 \
  --record-evidence \
  --base-url https://staging-api.example.com \
  --operator-id ops_stage_1 \
  --operator-role operations_admin \
  --api-key "$INTERNAL_OPERATOR_API_KEY"
```

Role review:

```bash
pnpm release:readiness:verify -- \
  --proof role_review \
  --environment production_like \
  --summary "Launch role review completed for launch-2026.04.10.1." \
  --note "References: ticket/GOV-12; roster ticket/GOV-12#launch-roster" \
  --evidence-links ticket/GOV-12,ticket/GOV-12#launch-roster \
  --record-evidence \
  --base-url https://staging-api.example.com \
  --operator-id ops_stage_1 \
  --operator-role operations_admin \
  --api-key "$INTERNAL_OPERATOR_API_KEY"
```

### 5. Review the release-readiness summary

Confirm that every required proof now shows a latest accepted `passed` record:

```bash
curl -sS \
  -H "x-operator-api-key: $INTERNAL_OPERATOR_API_KEY" \
  -H "x-operator-id: ops_stage_1" \
  -H "x-operator-role: operations_admin" \
  https://staging-api.example.com/release-readiness/internal/summary
```

### 6. Submit the governed launch request

Populate the generated `approval-request.template.json` truthfully, then submit:

```bash
curl -sS -X POST \
  'https://staging-api.example.com/release-readiness/internal/approvals' \
  -H 'x-operator-api-key: '"$INTERNAL_OPERATOR_API_KEY" \
  -H 'x-operator-id: ops_stage_1' \
  -H 'x-operator-role: operations_admin' \
  -H 'content-type: application/json' \
  --data @approval-request.template.json
```

### 7. Complete dual-control approval

The separate approver must review the generated approval record and then approve or reject it through the governed approval endpoints defined in [`docs/runbooks/release-launch-approval.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-launch-approval.md).

## Pass and fail criteria

### `platform_alert_delivery_slo`

Pass:

- expected target shows degraded health at the expected severity
- durable operations alert evidence exists
- the probe records accepted evidence with `passed`

Fail:

- target health does not degrade as expected
- no matching operations alert exists
- probe output is failed or evidence recording is rejected

### `critical_alert_reescalation`

Pass:

- the selected critical alert shows at least the expected re-escalation count
- the probe records accepted evidence with `passed`

Fail:

- no qualifying overdue critical alert exists
- re-escalation count stays below the required threshold
- evidence recording is rejected

### `database_restore_drill`

Pass:

- restored API boots against the restored backup
- required reads succeed after restore
- the probe records accepted evidence with `passed`

Fail:

- schema drift or missing-table failures appear
- required operator reads fail
- evidence recording is rejected

### `api_rollback_drill`

Pass:

- prior API artifact deploys against the current schema
- auth and internal monitoring reads remain available
- the probe records accepted evidence with `passed`

Fail:

- runtime migration assumptions or incompatibilities appear
- required operator reads fail
- evidence recording is rejected

### `worker_rollback_drill`

Pass:

- worker heartbeat resumes within the expected stale window
- queue processing is safe and no duplicate execution is observed
- the probe records accepted evidence with `passed`

Fail:

- heartbeat does not resume
- queue safety is uncertain or duplicate effects are observed
- evidence recording is rejected

### `secret_handling_review`

Pass:

- secret inventory, rotation, and environment isolation are reviewed against the launch environment
- evidence links point to real review artifacts
- the manual attestation is recorded as accepted evidence

Fail:

- review is incomplete
- launch secrets remain unverified
- evidence links are missing or not durable

### `role_review`

Pass:

- launch roster is explicitly reviewed
- role mappings are approved
- evidence links point to the reviewed roster and approval references

Fail:

- roster is incomplete
- role assignments are not approved
- approval identity separation is unclear

### final governed launch approval

Pass:

- all required proofs have latest accepted `passed` evidence
- evidence is fresh enough for approval policy
- checklist attestations are complete
- open blockers are empty
- a separate approver identity approves the request

Fail:

- any required proof is missing, failed, or stale
- any checklist section is incomplete
- requester and approver are the same identity
- blockers remain open

## Evidence artifacts to collect

Collect and preserve:

- generated probe or verifier JSON output
- links to tickets, dashboards, screenshots, and logs
- approval request JSON used for submission
- approval id and final approval or rejection record
- timestamps for start, observation, completion, and submission
- operator identities and roles used at each step

Use the committed templates in [`docs/templates/release-launch-closure`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/templates/release-launch-closure) or the generated evidence files inside the scaffolded pack.

## Abort guidance

Abort the launch-closure run if:

- the manifest fails validation
- the environment cannot produce accepted evidence
- the probe returns failed status for any required step
- the rollback drill reveals unsafe runtime behavior
- the requester cannot identify a separate approver

If a probe fails:

1. stop progressing to later steps
2. keep the failure evidence
3. open a blocker with owner and remediation path
4. rerun only after the blocking condition is understood and remediated

## Related references

- [`docs/runbooks/release-readiness-evidence-api.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-readiness-evidence-api.md)
- [`docs/runbooks/platform-alert-delivery-targets.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/platform-alert-delivery-targets.md)
- [`docs/runbooks/restore-and-rollback-drills.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/restore-and-rollback-drills.md)
- [`docs/runbooks/release-launch-approval.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/release-launch-approval.md)
- [`docs/security/secret-handling-review.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/security/secret-handling-review.md)
- [`docs/security/role-review.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/security/role-review.md)
