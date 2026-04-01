# Wallet Projection Manual Review Queue Runbook

## Purpose

This runbook exports only the hard wallet migration cases that safe automated repair intentionally leaves untouched.

The export is read-only.

## Included review cases

- conflicting customer identity records
- missing wallet address where automatic repair cannot proceed
- invalid wallet address where automatic repair cannot proceed
- wallet and legacy address mismatch
- wallet already linked to another customer account
- multiple product-chain wallets on one customer account

Missing-customer rows that are now safely repairable are intentionally excluded from this queue.

## Script

From `apps/api`:

    pnpm run export:wallet-projection-manual-review-queue

## Supported options

### Default JSON to stdout

    pnpm run export:wallet-projection-manual-review-queue

### JSON export for a limited batch

    pnpm run export:wallet-projection-manual-review-queue -- --limit=100

### One user by email

    pnpm run export:wallet-projection-manual-review-queue -- --email=user@example.com

### CSV export to a file

    pnpm run export:wallet-projection-manual-review-queue -- --format=csv --output=.artifacts/wallet-manual-review.csv

### JSON export to a file

    pnpm run export:wallet-projection-manual-review-queue -- --format=json --output=.artifacts/wallet-manual-review.json

## Output

### JSON

JSON output includes:
- `summary`
- `items`

### CSV

CSV output includes one row per manual review item with:
- legacy user id
- email
- supabase user id
- product chain id
- review case
- suggested action
- legacy ethereum address
- wallet addresses
- customer id
- customer account id
- linked customer account id
- reason

## Suggested action meanings

- `repair_legacy_wallet_address`
- `reconcile_wallet_mismatch`
- `review_wallet_link_conflict`
- `resolve_customer_identity_conflict`
- `resolve_duplicate_wallets`

## Recommended rollout

1. Run wallet coverage audit
2. Run safe automated repair commands
3. Export the manual review queue
4. Hand the export to operators for case-by-case resolution
5. Re-run the wallet coverage audit after manual fixes
6. Only reduce legacy fallback after the manual queue is understood and shrinking

## Success condition

The manual review queue should become smaller over time, and the remaining items should represent true exceptions rather than large unresolved migration populations.
