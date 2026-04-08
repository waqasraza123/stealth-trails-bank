# Launch Checklist

## Release identity

- target release identifier recorded
- release approver recorded
- rollback target release identifier recorded
- release-readiness summary reviewed

## Security configuration

- `NODE_ENV=production`
- `CORS_ALLOWED_ORIGINS` limited to approved explicit origins
- `SHARED_LOGIN_ENABLED=false` or formal exception attached
- shared-login production defaults are not in use
- `JWT_SECRET` rotated for launch
- `INTERNAL_OPERATOR_API_KEY` rotated for launch
- `INTERNAL_WORKER_API_KEY` rotated for launch
- database credentials rotated or confirmed unique to production
- managed deposit signer key confirmed non-development and non-treasury-root

## Access and governance

- operator roster reviewed
- operator role assignments reviewed
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
- operator review workflow verified
- oversight hold workflow verified
- incident package release workflow verified
- worker heartbeat and reconciliation monitoring verified

## Contract and chain proof

- contract deployment addresses recorded
- contract tests and invariants passed for the release artifact
- RPC endpoint and chain id verified against launch environment
- managed signer wallet funding and ownership posture verified

## Final sign-off

- launch blocker list reviewed
- unresolved risks documented and accepted
- rollback owner on call
- operator owner on call
- worker owner on call
- release approved
- latest release-readiness evidence gaps accepted or remediated
- governed launch approval requested and approved in release-readiness workflow
