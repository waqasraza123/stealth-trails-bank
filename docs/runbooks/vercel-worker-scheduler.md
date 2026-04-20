# Vercel Worker Scheduler

## Purpose

The `stealth-trails-bank-worker` Vercel project now exposes one-shot worker
functions under `/api/cron/*`. The project is on a Vercel Hobby tier, so
minute-level Vercel Cron Jobs are not available. Scheduling is therefore driven
from GitHub Actions in [.github/workflows/vercel-worker-scheduler.yml](../../.github/workflows/vercel-worker-scheduler.yml).

## Current Schedule

- `worker-tick`: every 5 minutes
- `ledger-reconciliation-scan`: every 15 minutes
- `solvency-snapshot`: every 15 minutes
- `platform-alert-reescalation`: every 15 minutes

The same workflow also supports manual dispatch for:

- `tick`
- `maintenance`
- `all`

## Required GitHub Secrets

Add these repository secrets before enabling the scheduler workflow:

- `STEALTH_TRAILS_BANK_WORKER_CRON_SECRET`
  - must match the worker Vercel project's `CRON_SECRET`
- `STEALTH_TRAILS_BANK_WORKER_VERCEL_BYPASS_SECRET`
  - Vercel deployment protection bypass secret for the worker project

## Required Vercel Worker Environment

The worker Vercel project must have these production variables:

- `WORKER_ID`
- `INTERNAL_API_BASE_URL`
- `INTERNAL_WORKER_API_KEY`
- `WORKER_EXECUTION_MODE`
- `RPC_URL`
- `CRON_SECRET`

## Required API Environment

The API Vercel project must expose the same `INTERNAL_WORKER_API_KEY` value so
the worker can authenticate against internal worker endpoints.

## Deployment Protection Notes

The workflow authenticates each request with two layers:

- `Authorization: Bearer <CRON_SECRET>`
- `x-vercel-protection-bypass: <Vercel bypass secret>`

This is required because the worker project is protected by Vercel deployment
protection and the cron endpoints themselves also enforce `CRON_SECRET`.

## Operational Verification

After updating secrets:

1. Run the workflow manually with target `tick`.
2. Confirm the job succeeds in GitHub Actions.
3. Verify the worker endpoint responds successfully through Vercel.
4. Confirm the API project is healthy enough to accept internal worker calls.

If the workflow returns `FUNCTION_INVOCATION_FAILED`, the next check is the API
runtime because the worker depends on the API for every iteration.
