# Threat Model

## Scope

This document models the current release candidate surface for:
- `apps/api`
- `apps/worker`
- `apps/admin`
- `packages/config`
- Prisma-backed customer, operator, ledger, and reconciliation state

It does not treat the legacy staking prototype as a production-ready custody path.

## Protected assets

- customer identity, balances, transaction intents, and incident data
- operator-only review, restriction, export, and release workflows
- internal worker execution and reconciliation control paths
- signing material for contract writes and managed deposit execution
- JWT signing secret and internal API keys
- PostgreSQL primary data and audit history

## Trust boundaries

1. public customer requests into `apps/api`
2. operator traffic into internal operator endpoints guarded by bearer-authenticated operator identity
3. worker traffic into internal worker endpoints guarded by `x-worker-api-key`
4. API and worker runtime secret material loaded from environment variables
5. database persistence boundary behind Prisma
6. blockchain RPC and signing boundary for deposit execution and contract access

## Entry points

- customer auth and finance APIs
- internal operator APIs for review cases, oversight incidents, reconciliation, monitoring, and incident package release workflows
- internal worker APIs for queue pickup, broadcast recording, confirmation, settlement, reconciliation scan triggering, and heartbeat reporting
- local shared-login bootstrap on API startup
- admin console browser storage for operator session values

## Primary threat scenarios

### 1. Compromise of internal operator key

Impact:
- unauthorized review actions
- oversight holds and releases
- reconciliation replay and repair actions
- governed incident export and release approvals

Current mitigations:
- dedicated internal operator API key guard
- per-workflow operator-role checks for sensitive actions
- audit and event history on most operator workflows

Residual risk:
- one operator API key still gates the internal operator surface
- browser-stored operator session values increase workstation theft exposure

### 2. Compromise of internal worker key

Impact:
- forged worker heartbeats
- unauthorized queue pickup and settlement transitions
- fake reconciliation scan triggers

Current mitigations:
- dedicated internal worker API key guard
- worker identity header required
- worker runtime health and alerting now surface anomalous behavior

Residual risk:
- one worker key remains a high-value secret until key rotation and environment segregation are operationally enforced

### 3. Compromise of signing keys

Assets at risk:
- `ETHEREUM_PRIVATE_KEY`
- `WORKER_DEPOSIT_SIGNER_PRIVATE_KEY`

Impact:
- unauthorized chain writes
- treasury or deposit execution misuse

Current mitigations:
- managed worker mode requires a separate deposit signer
- worker docs already state the deposit signer must not be a treasury root key
- synthetic mode is blocked in production

Residual risk:
- environment-variable secrets still require external secret-manager discipline
- no HSM or multisig-backed runtime signing path exists yet

### 4. Shared-login bootstrap misuse

Impact:
- predictable operator-style credentials could create unauthorized access if enabled unsafely

Current mitigations:
- shared-login bootstrap hard-fails when enabled outside development
- operator-facing admin routes now require bearer-token identity instead of browser-supplied operator API-key headers

Residual risk:
- shared-login bootstrap remains a privileged convenience path and must stay disabled for real launch unless a documented exception is approved

### 5. Database compromise or destructive migration failure

Impact:
- customer funds ledger state and audit history loss
- broken reconciliation and incident workflows

Current mitigations:
- additive migrations
- ledger and audit persistence now exist
- restore and rollback drills are documented in Phase 12

Residual risk:
- release readiness still depends on actually running restore drills against fresh backups

### 6. Queue backlog or reconciliation blind spot

Impact:
- delayed settlements
- unreviewed mismatches
- stale worker execution

Current mitigations:
- worker heartbeat persistence
- reconciliation scan history
- durable platform alerts and operations status snapshot

Residual risk:
- alert routing, paging, and external metrics sinks are still infrastructure responsibilities outside this repo

## Highest-priority controls before launch

1. keep shared-login bootstrap disabled in production unless formally approved
2. store API, worker, JWT, database, and signer secrets in an external secret manager
3. rotate internal operator and worker keys before launch
4. prove restore and rollback drills against current production-like data
5. run the repo-owned Phase 12 verification suite and record contract, integration, and end-to-end finance proof for the candidate
6. complete role review and confirm no privileged workflow depends on an unapproved role mapping

## Launch blockers from this threat model

- no evidence of completed restore drill
- no evidence of rotated launch secrets
- no staging or production-like role review evidence yet
- no governed evidence proving the repo-owned verification suite was run for the current release candidate
