# Phase 14 — Public Solvency Verification and Governed Execution

## Why this phase exists

The repo already has internal bank-grade infrastructure:
- customer account lifecycle and wallet ownership
- ledger-backed balances and transaction controls
- lending and staking product surfaces
- internal solvency snapshots and policy pause controls
- admin/control-plane visibility

What it does not yet have is a complete public trust surface. A production-ready decentralized bank must let outsiders and customers verify the bank’s solvency posture and understand when critical flows are paused, resumed, or governed.

## Phase goal

Make the bank externally inspectable without weakening the internal control plane.

This phase turns internal solvency state into operator-safe, customer-usable, and publicly visible trust artifacts.

## Scope of the first slice

This slice is intentionally narrow and production-useful:

1. **Public solvency report index**
   - list recent signed solvency reports
   - fetch the latest signed report
   - fetch a report by snapshot id

2. **Customer liability proof retrieval**
   - fetch the latest or snapshot-specific customer inclusion proof
   - expose asset-level liability roots, leaf payloads, and Merkle proof paths

3. **Customer and public web trust surfaces**
   - public trust center route in `apps/web`
   - authenticated customer proof-verification route in `apps/web`
   - show signed report details, reserve/liability totals, asset roots, and verification status

4. **Governed resume continuation**
   - preserve the existing manual resume workflow
   - expose enough information for operators and customers to understand why pause state remains active

## Out of scope for this slice

- public Merkle download bundles
- third-party attestor integration
- onchain report anchoring
- multisig-enforced treasury execution redesign
- public historical CSV/PDF export
- external notarization pipeline

## Architecture fit

This phase builds on:
- `SolvencySnapshot`
- `SolvencyAssetSnapshot`
- `SolvencyLiabilityLeaf`
- `SolvencyReport`
- `SolvencyPolicyState`
- `SolvencyPolicyResumeRequest`

No customer balance mutation is introduced. Public artifacts remain derived from authoritative internal state.

## API additions

### Public
- `GET /solvency/public/reports`
- `GET /solvency/public/reports/latest`
- `GET /solvency/public/reports/:snapshotId`

### Authenticated customer
- `GET /solvency/me/liability-proof`

## Web additions

### Public trust center
Route: `/trust/solvency`

Shows:
- latest signed report summary
- recent historical reports
- asset-level liabilities, usable reserves, deltas, ratios, Merkle roots
- policy state embedded in the signed payload

### Customer proof verification
Route: `/proofs/me`

Shows:
- latest report binding
- customer leaf payload(s)
- Merkle proof path(s)
- local verification result against the published asset root

## Security and invariants

- public report views must never expose another customer’s leaf payload
- customer proof endpoint remains JWT-protected
- verification UI must not mutate bank state
- public reports must remain snapshot-bound and signature-bound
- pause/resume state remains governed by the API, not the web client

## Next follow-up after this slice

After this slice, the next best extension is:
- public downloadable proof bundles
- signed reserve attestation packages
- onchain anchoring of report hashes
- governed timelock for policy resume
