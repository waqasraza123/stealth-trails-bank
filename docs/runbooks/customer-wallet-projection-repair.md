# Customer Wallet Projection Repair Runbook

## Purpose

This runbook repairs the safest wallet migration gap first.

The command only repairs rows where:
- legacy `User.ethereumAddress` exists
- `Customer` exists
- `CustomerAccount` exists
- the product-chain wallet projection is missing

It does not create missing `Customer` or `CustomerAccount` rows, and it does not auto-resolve conflicts or mismatches.

## Script

From `apps/api`:

    pnpm run repair:customer-wallet-projections

Dry-run mode is the default.

## Supported options

### Dry-run all rows

    pnpm run repair:customer-wallet-projections

### Apply safe repairs

    pnpm run repair:customer-wallet-projections --apply

### Dry-run one user

    pnpm run repair:customer-wallet-projections --email=user@example.com

### Apply one user

    pnpm run repair:customer-wallet-projections --email=user@example.com --apply

### Dry-run limited batch

    pnpm run repair:customer-wallet-projections --limit=100

### Apply limited batch

    pnpm run repair:customer-wallet-projections --limit=100 --apply

## Output shape

The script prints JSON with:
- `summary`
- `plannedActions`
- `conflicts`

## Action meanings

- `already_projected`
  - the expected product-chain wallet projection already exists

- `repair_wallet_only`
  - `Customer` and `CustomerAccount` exist and the wallet projection can be safely created or attached

- `missing_wallet_address`
  - the legacy user has no usable wallet address to project

- `missing_customer_projection`
  - `Customer` does not exist yet, so this command intentionally does nothing

- `missing_customer_account`
  - `CustomerAccount` does not exist yet, so this command intentionally does nothing

- `conflict`
  - existing data prevents safe automatic repair and requires manual review

## Repair methods

- `create_wallet`
  - create a new product-chain wallet projection

- `attach_existing_wallet`
  - attach an existing unlinked wallet row to the customer account and normalize its runtime attributes

## Recommended rollout

1. Run wallet coverage audit in summary mode
2. Run this repair command in dry-run mode
3. Review `repair_wallet_only` and `conflict` rows
4. Apply a small limited batch
5. Re-run the wallet coverage audit
6. Expand the repair batch only after the delta looks correct

## Safety boundary

This command intentionally leaves these cases untouched:
- wallet and legacy address mismatch
- wallet already linked to another account
- missing customer projection
- missing customer account
- multiple product-chain wallets on one account

Those should be handled in later dedicated repair flows or manual review.
