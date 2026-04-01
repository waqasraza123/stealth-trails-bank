# Wallet Projection Repair Audit Events

## Purpose

This runbook explains the durable database audit trail created by applied wallet projection repairs.

Only apply-mode repairs write audit events.

Dry-run executions do not write audit rows.

## Covered commands

These commands now create AuditEvent rows for each applied repair:

- repair:missing-customer-projections
- repair:customer-account-wallet-projections
- repair:customer-wallet-projections

## Audit event shape

Each event uses:

- actorType = system
- actorId = repair command name
- targetType = CustomerAccount
- targetId = repaired customer account id
- customerId = owning customer id

## Action values

Expected action values are:

- wallet_projection.missing_customer_projection.repaired
- wallet_projection.missing_customer_account.repaired
- wallet_projection.wallet_only.repaired

## Metadata fields

Each repair event stores metadata with:

- batchRunId
- repairCommand
- repairSurface
- repairMethod
- legacyUserId
- supabaseUserId
- email
- productChainId
- customerAccountId
- walletId
- walletAddress
- customerCreated
- customerAccountCreated
- walletCreated
- walletAttached

## Example query

Use PostgreSQL to inspect recent wallet projection repair events:

~~~bash
psql "$DATABASE_URL" -c "select \"createdAt\", \"actorId\", action, \"targetId\", metadata from \"AuditEvent\" where action like 'wallet_projection.%' order by \"createdAt\" desc limit 20;"
~~~

## Recommended operator usage

1. run a safe repair command or safe batch in apply mode
2. inspect command JSON output
3. inspect AuditEvent rows for durable confirmation
4. use batchRunId to correlate events to one safe batch run
5. keep exported JSON artifacts for operator handoff
6. rely on database audit rows as the long-term trail

## Success condition

A production repair run should now leave both:

- JSON command artifacts for operator review
- durable AuditEvent records in the database
- optional batch-linked event correlation through batchRunId
