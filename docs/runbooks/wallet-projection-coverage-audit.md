# Wallet Projection Coverage Audit Runbook

## Purpose

This runbook measures the exact wallet migration repair surface for legacy user profiles.

The audit is read-only.

## Preconditions

- `Customer`, `CustomerAccount`, and `Wallet` exist in the live Prisma schema
- database runtime variables are configured
- `PRODUCT_CHAIN_ID` is set when a non-default product chain should be audited
- the API package already includes the wallet repair and manual-review tooling

## Script

From `apps/api`:

    pnpm run audit:wallet-projection-coverage

## Supported options

### Summary only

    pnpm run audit:wallet-projection-coverage -- --summary-only

### Actionable rows only

    pnpm run audit:wallet-projection-coverage -- --only-actionable

### One user by email

    pnpm run audit:wallet-projection-coverage -- --email=user@example.com

### Limited batch

    pnpm run audit:wallet-projection-coverage -- --limit=100

### Limited actionable batch summary

    pnpm run audit:wallet-projection-coverage -- --limit=100 --only-actionable --summary-only

## Output shape

The script prints JSON with:

- `summary`
- `details`

Each detail row now includes:

- `status`
- `addressSource`
- `repairCommand`
- `manualReviewCase`
- `legacyEthereumAddress`
- `walletAddresses`
- `customerId`
- `customerAccountId`
- `linkedCustomerAccountId`
- `reason`

## Status meanings

### Healthy

- `wallet_projected`
  - wallet projection already exists for the configured product chain

### Auto-repairable

- `repair_missing_customer_projection`
  - safe for `repair:missing-customer-projections`

- `repair_missing_customer_account`
  - safe for `repair:customer-account-wallet-projections`

- `repair_wallet_only`
  - safe for `repair:customer-wallet-projections`

### Manual review only

- `manual_review_missing_wallet_address`
  - there is no usable legacy wallet address for the current repair path

- `manual_review_invalid_wallet_address`
  - the legacy wallet value exists but is not a valid EVM address

- `manual_review_conflicting_customer_records`
  - identity conflict exists between email and `supabaseUserId`

- `manual_review_wallet_linked_to_other_account`
  - the wallet address is already linked to another customer account

- `manual_review_wallet_legacy_mismatch`
  - wallet projection exists but differs from the legacy wallet address

- `manual_review_multiple_product_chain_wallets`
  - more than one product-chain wallet exists for the same customer account

## Address source meanings

- `wallet`
  - current public profile resolution should come from wallet projection

- `legacy`
  - current public profile resolution still depends on legacy wallet data

- `none`
  - no usable address is currently available

- `conflict`
  - the data shape is inconsistent and should not be treated as trustworthy

## Recommended rollout

1. Run the audit in summary-only mode
2. Review auto-repairable and manual-review counts separately
3. Run the bounded repair commands for safe rows
4. Export the manual-review queue for hard cases
5. Re-run the audit
6. Only tighten legacy fallback after the actionable population is shrinking and understood

## Success condition

The audit should converge toward:

- `wallet_projected` rising
- auto-repairable counts shrinking
- manual-review counts representing only true exceptions
