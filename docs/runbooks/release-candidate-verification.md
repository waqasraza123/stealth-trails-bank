# Release Candidate Verification

This runbook defines the repo-owned proof commands for the Phase 12 checks that can be verified directly from the codebase or CI.

## Purpose

Use these commands to produce durable proof for:

- `contract_invariant_suite`
- `backend_integration_suite`
- `end_to_end_finance_flows`

These proofs complement, but do not replace, the staging or production-like drill evidence required for alerting, restore, rollback, secret handling, and role review.

## Root command

Run the full automated verifier from the repository root:

```bash
pnpm release:readiness:verify -- --proof all-auto
```

That command runs:

- the contract invariant bundle:
  - `pnpm --filter @stealth-trails-bank/contracts test -- --grep invariant`
- the backend integration bundle:
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/transaction-intents/transaction-intents.integration.spec.ts src/transaction-intents/transaction-intents-operator.integration.spec.ts`
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/ledger-reconciliation/ledger-reconciliation.service.spec.ts src/release-readiness/release-readiness.service.spec.ts`
- the finance proof bundle:
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/transaction-intents/finance-flows.integration.spec.ts`
  - `pnpm --filter @stealth-trails-bank/api test -- --runTestsByPath src/transaction-intents/transaction-intents.replay.spec.ts src/transaction-intents/withdrawal-intents.replay.spec.ts src/transaction-intents/deposit-settlement-reconciliation.review-cases.spec.ts src/transaction-intents/withdrawal-settlement-reconciliation.review-cases.spec.ts`
  - `pnpm --filter @stealth-trails-bank/worker test`

Each automated proof is recorded as a command bundle with per-command status, duration, output tails, and coverage notes so the durable evidence matches the hardened platform surface instead of a single coarse command.

## Single-proof examples

### Contract invariants

```bash
pnpm release:readiness:verify -- --proof contract_invariant_suite
```

### Backend integration suite

```bash
pnpm release:readiness:verify -- --proof backend_integration_suite
```

### End-to-end finance flows

```bash
pnpm release:readiness:verify -- --proof end_to_end_finance_flows
```

## Recording automated proof

When an operator wants to persist the result into release-readiness evidence:

```bash
pnpm release:readiness:verify -- \
  --proof all-auto \
  --environment ci \
  --release-id api-2026.04.08.1 \
  --record-evidence \
  --base-url http://localhost:9101 \
  --operator-id ops_1 \
  --operator-role operations_admin \
  --api-key local-dev-operator-key
```

## Recording manual review evidence

Secret handling review:

```bash
pnpm release:readiness:verify -- \
  --proof secret_handling_review \
  --environment production_like \
  --summary "Launch secret rotation reviewed and approved." \
  --note "Rotation ticket SEC-42 attached." \
  --evidence-links docs/security/secret-handling-review.md,ticket/SEC-42 \
  --record-evidence \
  --base-url http://localhost:9101 \
  --operator-id ops_1 \
  --operator-role compliance_lead \
  --api-key local-dev-operator-key
```

Role review:

```bash
pnpm release:readiness:verify -- \
  --proof role_review \
  --environment production_like \
  --summary "Launch operator roster and role mappings reviewed." \
  --note "Approved roster stored in access-governance ticket GOV-12." \
  --evidence-links docs/security/role-review.md,ticket/GOV-12 \
  --record-evidence \
  --base-url http://localhost:9101 \
  --operator-id ops_1 \
  --operator-role compliance_lead \
  --api-key local-dev-operator-key
```

## Output

The verifier prints structured JSON. Automated proofs include:

- executed command bundle
- per-command labels and coverage
- per-command exit code
- aggregate duration
- per-command stdout tail
- per-command stderr tail

That payload is suitable for durable evidence storage and later launch approval review.

## Launch rule

This verifier closes only the code-level and attestation-backed proof categories. Phase 12 is still not complete until the staging or production-like drills are also run and recorded through the release-readiness workflow.
