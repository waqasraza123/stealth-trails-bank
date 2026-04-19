# Secret Handling Review

## Secret inventory

### API runtime

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `INTERNAL_OPERATOR_API_KEY`
- `INTERNAL_WORKER_API_KEY`
- `RPC_URL`
- `STAKING_CONTRACT_ADDRESS`
- `ETHEREUM_PRIVATE_KEY`
- optional shared-login bootstrap values

### Worker runtime

- `INTERNAL_WORKER_API_KEY`
- `RPC_URL`
- `WORKER_DEPOSIT_SIGNER_PRIVATE_KEY`

## Current code posture

Positive controls already present:
- internal operator and worker API keys are compared with `timingSafeEqual`
- internal API keys only fall back to local-development defaults when the environment is development
- wildcard CORS is rejected
- synthetic worker mode is blocked in production
- managed worker mode requires an explicit deposit signer key
- shared-login bootstrap now hard-fails outside development when explicitly enabled

Repo-local risks still present:
- secrets are environment variables, not secret-manager references
- `ETHEREUM_PRIVATE_KEY` and `WORKER_DEPOSIT_SIGNER_PRIVATE_KEY` remain raw hot-wallet material
- admin console keeps the operator bearer token in memory and persists only the API base URL
- shared-login bootstrap still exists and must not be treated as a launch-default auth posture

## Production requirements

1. load all secrets from a managed secret store or orchestrator secret injection path
2. do not commit `.env` files with live values
3. use distinct secrets per environment for:
   - JWT
   - internal operator API
   - internal worker API
   - database credentials
   - managed deposit signer
4. rotate all launch secrets immediately before the release candidate is promoted
5. keep shared-login bootstrap disabled outside development
6. ensure the managed deposit signer is narrowly scoped and not a treasury root or governance owner

## Required pre-launch checks

- verify production `NODE_ENV=production`
- verify `SHARED_LOGIN_ENABLED=false`
- verify `CORS_ALLOWED_ORIGINS` contains only explicit operator and customer origins
- verify operator and worker API keys are different
- verify JWT secret is unique to the environment and high entropy
- verify database credentials are not reused from development or staging
- verify no developer wallet private key is used for `ETHEREUM_PRIVATE_KEY` or `WORKER_DEPOSIT_SIGNER_PRIVATE_KEY`

## Blocking findings

- secret rotation evidence is not stored in-repo
- no HSM, KMS signing, or multisig-enforced runtime key path exists yet
- admin operator credentials remain browser-resident during console use

## Launch decision

This repo is closer to a launchable posture than before, but it is not release-ready until the operational controls above are completed outside the codebase and recorded in the launch checklist.
