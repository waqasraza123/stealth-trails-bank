# Customer Wallet Backfill Runbook

## Purpose

This runbook projects historical legacy `User.ethereumAddress` values into the new `Wallet` model for the configured product chain.

The script is additive and idempotent in the safe cases it handles.

## Preconditions

- `Customer`, `CustomerAccount`, and `Wallet` exist in the live Prisma schema
- Prisma client generation succeeds
- database runtime variables are configured
- `PRODUCT_CHAIN_ID` is set if a non-default product chain should be used
- the legacy `User` table still contains historical `ethereumAddress` values

## Script

From `apps/api`:

    pnpm run backfill:customer-wallets

Dry-run mode is the default.

## Supported options

### Dry-run all users

    pnpm run backfill:customer-wallets

### Apply all safe actions

    pnpm run backfill:customer-wallets -- --apply

### Dry-run one email

    pnpm run backfill:customer-wallets -- --email=user@example.com

### Apply one email

    pnpm run backfill:customer-wallets -- --email=user@example.com --apply

### Dry-run limited batch

    pnpm run backfill:customer-wallets -- --limit=100

### Apply limited batch

    pnpm run backfill:customer-wallets -- --limit=100 --apply

## Output shape

The script prints JSON with:
- `summary`
- `plannedActions`
- `conflicts`

## Action meanings

- `already_projected`
  - the customer account already has the expected wallet for the product chain

- `missing_wallet_address`
  - the legacy user has no usable `ethereumAddress`

- `invalid_wallet_address`
  - the legacy user has a non-empty but invalid EVM address and needs manual review

- `create_customer_account_and_wallet`
  - no customer projection exists yet, so the script will create `Customer`, `CustomerAccount`, and `Wallet`

- `create_account_and_wallet`
  - `Customer` exists but `CustomerAccount` does not, so the script will create both the missing account and wallet

- `create_wallet_only`
  - `Customer` and `CustomerAccount` already exist, but the wallet projection is missing

- `conflict`
  - existing data prevents safe automatic projection and requires manual review

## Conflict cases that require manual review

- `Customer` found by email and supabase user id do not match
- existing customer email does not match the legacy user email
- existing customer supabase user id does not match the legacy user supabase user id
- wallet address is already linked to another customer account
- customer account already has a different wallet for the product chain
- legacy ethereum address is invalid

## Recommended rollout

1. Run dry-run across all users
2. Review `conflicts`
3. Run apply for a small limited batch
4. Verify projected wallets in the database
5. Run apply across the remaining safe set
6. Keep the JSON output for audit and rollback analysis

## Post-run verification

Confirm that:
- intended customer accounts now have a wallet on the configured product chain
- no wallet address was linked to the wrong customer account
- conflicts were left untouched for manual repair
