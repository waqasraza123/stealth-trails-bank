# Wallet Projection Repair Audit Summary

## Purpose

This runbook summarizes recent wallet projection repair AuditEvent rows without writing SQL manually.

The script is read-only.

It summarizes recent repair history by:

- repair command
- repair surface
- UTC date

It can also return normalized recent event rows for operator review.

## Script

From apps/api:

~~~bash
pnpm run audit:wallet-projection-repair-events
~~~

## Supported options

### Default recent summary and event list

~~~bash
pnpm run audit:wallet-projection-repair-events
~~~

### Summary only

~~~bash
pnpm run audit:wallet-projection-repair-events -- --summary-only
~~~

### Limit the time window

~~~bash
pnpm run audit:wallet-projection-repair-events -- --days=7
~~~

### Limit the number of rows read

~~~bash
pnpm run audit:wallet-projection-repair-events -- --limit=50
~~~

### Filter to one repair command

~~~bash
pnpm run audit:wallet-projection-repair-events -- --command=repair:customer-wallet-projections
pnpm run audit:wallet-projection-repair-events -- --command=repair:customer-account-wallet-projections
pnpm run audit:wallet-projection-repair-events -- --command=repair:missing-customer-projections
~~~

### Filter to one repair surface

~~~bash
pnpm run audit:wallet-projection-repair-events -- --surface=wallet_only
pnpm run audit:wallet-projection-repair-events -- --surface=missing_customer_account
pnpm run audit:wallet-projection-repair-events -- --surface=missing_customer_projection
~~~

### Filter to one batch run

~~~bash
pnpm run audit:wallet-projection-repair-events -- --batch-run-id=YOUR_BATCH_RUN_ID
~~~

## Output shape

The script prints JSON with:

- summary
- recentEvents

### Summary fields

- generatedAt
- windowStart
- windowEnd
- days
- limit
- commandFilter
- surfaceFilter
- batchRunIdFilter
- scanned
- byCommand
- bySurface
- byDateUtc
- earliestEventAt
- latestEventAt

### Recent event fields

Each recent event includes normalized values for:

- batchRunId
- repairCommand
- repairSurface
- repairMethod
- customerId
- customerAccountId
- walletId
- walletAddress
- legacyUserId
- supabaseUserId
- email
- customerCreated
- customerAccountCreated
- walletCreated
- walletAttached

## Notes

- date grouping is in UTC
- the script only reads AuditEvent rows produced by wallet projection repair commands
- if no rows match the current window or filters, the summary still returns successfully with zero counts
- --batch-run-id is the safest way to isolate one applied safe batch run

## Recommended operator usage

1. run a repair command or safe batch in apply mode
2. run this summary script for the last 1 to 7 days, or by exact batch run id
3. review totals by command and surface
4. inspect recent normalized events when needed
5. keep SQL for deep investigation only, not routine review

## Success condition

Operators can review recent wallet projection repair history from one built-in JSON report, or isolate exactly one batch by batch run id, without hand-written SQL.
