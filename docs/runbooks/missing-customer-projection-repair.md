# Missing Customer Projection Repair Runbook

## Purpose

This runbook repairs the bounded missing-customer projection case.

The command only repairs rows where:
- `Customer` does not exist yet
- legacy `User.supabaseUserId` and `User.email` are internally consistent
- legacy `User.ethereumAddress` exists and is a valid EVM address
- no wallet with the same product-chain address is already linked to another customer account

The command creates:
- `Customer`
- `CustomerAccount`
- `Wallet`

It does not repair identity conflicts, linked-wallet conflicts, invalid wallet addresses, or existing customer projections.

## Script

From `apps/api`:

    pnpm run repair:missing-customer-projections

Dry-run mode is the default.

## Supported options

### Dry-run all rows

    pnpm run repair:missing-customer-projections

### Apply safe repairs

    pnpm run repair:missing-customer-projections -- --apply

### Dry-run one user

    pnpm run repair:missing-customer-projections -- --email=user@example.com

### Apply one user

    pnpm run repair:missing-customer-projections -- --email=user@example.com --apply

### Dry-run limited batch

    pnpm run repair:missing-customer-projections -- --limit=100

### Apply limited batch

    pnpm run repair:missing-customer-projections -- --limit=100 --apply

## Output shape

The script prints JSON with:
- `summary`
- `plannedActions`
- `conflicts`

## Action meanings

- `repair_customer_account_and_wallet`
  - a safe missing-customer row can be fully repaired

- `missing_wallet_address`
  - the row has no usable legacy wallet address

- `invalid_wallet_address`
  - the row has a legacy wallet value, but it is not a valid EVM address

- `customer_exists`
  - a customer projection already exists, so this command intentionally does nothing

- `conflict`
  - identity or wallet linkage prevents safe automatic repair

## Repair methods

- `create_wallet`
  - create a new product-chain wallet after creating customer and account

- `attach_existing_wallet`
  - attach an existing unlinked wallet row after creating customer and account

## Important note

This command intentionally creates projection-only `Customer` rows and does not populate `passwordHash`.

Credential migration for historical users remains a separate auth concern.

## Recommended rollout

1. Run wallet coverage audit
2. Run this command in dry-run mode
3. Review `repair_customer_account_and_wallet` and `conflict` rows
4. Apply a small limited batch
5. Re-run wallet coverage audit
6. Re-run manual-review export and confirm the queue shrinks
