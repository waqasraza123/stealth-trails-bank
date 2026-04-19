# Launch Checklist

Use this checklist with the Phase 12 operator program in [`docs/runbooks/phase-12-launch-closure.md`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/runbooks/phase-12-launch-closure.md).

If you want the repo to print the ordered checklist directly, use:

```bash
pnpm release:launch-closure -- checklist
```

To scope the checklist to a real candidate manifest:

```bash
pnpm release:launch-closure -- checklist --manifest ./launch-manifest.json
```

Before any staging-like execution starts:

- complete the manifest in [`docs/templates/release-launch-closure/environment-manifest.template.json`](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/docs/templates/release-launch-closure/environment-manifest.template.json)
- validate it with `pnpm release:launch-closure -- validate --manifest <path>`
- scaffold the execution pack with `pnpm release:launch-closure -- scaffold --manifest <path> --output-dir <path> --force`

Important truth:

- repo-owned automation can satisfy `contract_invariant_suite`, `backend_integration_suite`, and `end_to_end_finance_flows`
- local dry-runs for restore and rollback are not accepted launch proof
- accepted proof for alerting, restore, rollback, secret review, and role review must come from `staging`, `production_like`, or `production`

## Release identity

- target release identifier recorded
- release approver recorded
- rollback target release identifier recorded
- release-readiness summary reviewed

## Security configuration

- `NODE_ENV=production`
- `CORS_ALLOWED_ORIGINS` limited to approved explicit origins
- `SHARED_LOGIN_ENABLED=false`
- shared-login bootstrap is not configured as a staging, production-like, or production fallback
- `JWT_SECRET` rotated for launch
- `INTERNAL_OPERATOR_API_KEY` rotated for launch
- `INTERNAL_WORKER_API_KEY` rotated for launch
- database credentials rotated or confirmed unique to production
- managed deposit signer key confirmed non-development and non-treasury-root

## Access and governance

- operator roster reviewed
- operator role assignments reviewed
- admin console bearer-token flow verified without browser token persistence across reload
- role review evidence recorded in release-readiness evidence
- incident package release approvers reviewed
- account-hold apply and release roles reviewed

## Data and recovery

- latest backup completed successfully
- restore drill completed and evidence recorded in release-readiness evidence
- API rollback drill completed and evidence recorded in release-readiness evidence
- worker rollback drill completed and evidence recorded in release-readiness evidence

## Platform health

- operations status endpoint returns healthy or explicitly understood warning state
- no stale workers
- no unexpected open critical platform alerts
- no unresolved failed reconciliation scan in the recent window
- no unexplained critical reconciliation mismatch remains open

## Functional proof

- customer sign-up or approved auth flow verified
- deposit request flow verified
- withdrawal request flow verified
- end-to-end finance flow evidence recorded in release-readiness evidence
- operator review workflow verified
- oversight hold workflow verified
- incident package release workflow verified
- worker heartbeat and reconciliation monitoring verified

## Contract and chain proof

- contract deployment addresses recorded
- contract invariant suite evidence recorded in release-readiness evidence
- backend integration suite evidence recorded in release-readiness evidence
- RPC endpoint and chain id verified against launch environment
- managed signer wallet funding and ownership posture verified

## Final sign-off

- launch blocker list reviewed
- unresolved risks documented and accepted
- secret handling review evidence recorded in release-readiness evidence
- rollback owner on call
- operator owner on call
- worker owner on call
- release approved
- latest release-readiness evidence gaps accepted or remediated
- governed launch approval requested and approved in release-readiness workflow
