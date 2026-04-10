# Critical-Feature End-to-End Expansion Plan

## Purpose

This document turns the Phase 12 "end-to-end finance flows" requirement into a repo-specific Playwright implementation plan for the customer and admin critical paths.

It is intentionally scoped around critical financial and governed workflows, not every routed page equally.

## Strategy

Use a hybrid end-to-end strategy:

- deterministic mocked-network Playwright projects own the full edge-case matrix
- a smaller live-stack smoke layer proves the local or CI wiring still boots against the real dev stack

This keeps the suite broad enough to prove critical workflow behavior while avoiding excessive flake and long runtime from trying to force every edge case through a live environment.

## Playwright Project Structure

The suite should be organized into these projects:

- `mocked-web`
- `mocked-admin`
- `live-web-smoke`
- `live-admin-smoke`

The mocked projects are the default broad coverage layer. The live projects stay intentionally short and only prove real boot, routing, and critical shell rendering.

## Spec Layout

Replace broad app-level specs with workflow-oriented specs:

### Customer specs

- `auth-and-routing.spec.ts`
- `dashboard.spec.ts`
- `profile-security.spec.ts`
- `wallet-deposits.spec.ts`
- `wallet-withdrawals.spec.ts`
- `transactions.spec.ts`
- `yield.spec.ts`

### Admin specs

- `admin-session-and-routing.spec.ts`
- `operations-and-health.spec.ts`
- `queues.spec.ts`
- `accounts-and-restrictions.spec.ts`
- `reconciliation.spec.ts`
- `alerts.spec.ts`
- `launch-readiness.spec.ts`

### Live smoke specs

- `smoke-live-web.spec.ts`
- `smoke-live-admin.spec.ts`

## Test Infrastructure Direction

Add deterministic Playwright helpers and fixtures for:

- response-envelope builders for successful, empty, stale, and failed responses
- reusable customer auth localStorage seeders
- reusable admin operator-session localStorage seeders
- scenario-level API mocking helpers instead of one monolithic route handler
- route assertion helpers that verify critical mutations were sent with the expected payload shape

Keep these fixture contracts test-local. No production API or runtime contract changes are required for this plan.

## Scenario Naming Convention

Use a small shared scenario vocabulary so coverage stays readable:

- `happy`
- `empty`
- `stale`
- `validation_error`
- `api_error`
- `governed_action_success`
- `governed_action_failure`

## Critical Coverage Matrix

### Customer auth and routing

- sign-in success
- sign-in API failure
- unauthenticated protected-route redirect
- signed-in user blocked from auth routes
- locale switch persists after reload
- `/staking` redirects to `/yield`
- `/create-pool` redirects to `/yield`
- unknown routes redirect safely

### Customer dashboard

- healthy balances and recent activity render
- empty balances and history render calm empty states
- stale balance or timestamp notice appears
- API failure renders shell with inline error state
- RTL render keeps direction and refs safe

### Customer profile and security

- password rotation succeeds for customer-backed accounts
- confirm-password mismatch is blocked client-side
- password rotation API failure renders visible error feedback
- notification preference save succeeds and persists the updated state
- notification preference failure preserves the draft state
- legacy-only profiles render a read-only settings state

### Wallet deposit flow

- valid deposit request succeeds and shows tracker or reference state
- invalid amount is blocked client-side
- missing wallet address blocks request
- supported-assets load failure renders degraded state
- deposit API failure surfaces actionable error
- copy address and QR toggle still work in the happy path
- no supported assets renders a safe empty state

### Wallet withdrawal flow

- valid withdrawal request succeeds with review state
- invalid EVM address is blocked
- self-address is blocked
- insufficient available balance is blocked
- unsupported or assetless request is blocked
- balances load failure preserves shell and blocks unsafe submit
- withdrawal API failure surfaces actionable error
- RTL address rendering remains LTR-safe in refs

### Transactions

- search by address or reference filters correctly
- type filter and status filter combine correctly
- no matching rows shows an empty result state
- history API failure renders inline failure without collapsing the shell
- detail drawer opens and timeline or reference content is visible
- bidi-safe address and reference rendering appear in rows and detail

### Yield

- policy-gated execution disables actions
- execution-enabled mode allows deposit, withdraw, claim, and emergency actions
- invalid amount validation blocks mutations
- backend failure on each action surfaces visible error feedback
- read-model unavailable state renders a limited-read warning
- yield feed failure preserves the page shell

### Admin session and shell

- session save persists and restores after reload
- empty session shows the credentials-required fallback
- locale or RTL persists after reload
- default `/` redirects to `/operations`
- left-rail navigation changes route and keeps the selected section

### Operations overview

- healthy system summary renders health and readiness counts
- degraded and blocked status render the correct emphasis
- operations summary fetch failure shows an unavailable state

### Queues

- review-case selection updates the workspace
- start case mutation succeeds and flashes success
- add note succeeds and clears the note field
- request release requires governed confirmation and succeeds
- resolve and dismiss actions require governed confirmation
- mutation failure shows an inline critical notice and preserves the workspace
- empty pending-release-review list renders the expected empty state

### Accounts and restrictions

- incident selection updates the workspace
- start incident, add note, and place hold succeed
- resolve incident succeeds
- dismiss incident succeeds
- failure path shows an inline error notice
- active-hold empty state is covered

### Reconciliation

- mismatch selection updates the workspace
- replay confirm, replay settle, open review, repair balance, and dismiss each dispatch correctly
- governed confirmation paths are respected
- mismatch or runs load failure renders an unavailable state
- no mismatch selected renders a locked action state

### Alerts

- alert selection updates the workspace
- acknowledge, route to review, and retry deliveries succeed
- action failure shows an inline error
- delivery-health list renders degraded targets
- no selected alert leaves controls locked

### Launch readiness

- approval selection updates the workspace
- stale evidence warning is visible when present
- approve succeeds with note
- reject succeeds with rejection note
- failure path shows an inline error
- no approval selected keeps governed actions unavailable

### Live full-stack smoke

- the root dev stack boots and the customer sign-in page loads
- the admin shell loads and can save operator session state
- one protected customer route and one critical admin route render against the live API
- smoke coverage asserts no fatal boot or runtime regressions rather than every edge case

## Acceptance Criteria

This plan is considered materially implemented when:

- every critical workflow family above has at least one happy-path test and one degraded or failure-path test
- every state-changing admin action has both success and mutation-failure coverage
- every money-movement customer action has both validation-block and backend-failure coverage
- redirect compatibility routes are explicitly asserted
- RTL persistence is covered in both customer and admin suites
- the mocked suites remain the default broad `test:e2e` coverage layer
- the live smoke layer is gated to environments where the real stack is available

## Scope Boundaries

The following stay intentionally out of the deep edge-case matrix unless they later become state-critical:

- `Loans`, which now has a truthful managed-lending surface and only needs selective workflow smoke until it becomes part of the release-critical matrix
- purely presentational summaries such as treasury, audit, or operations overviews when they do not dispatch governed state changes

## Assumptions

- critical means customer and admin critical paths, not every route equally
- the existing backend APIs remain the source of truth
- localization and RTL behavior are first-class and must be asserted in customer and admin coverage
- edge-case coverage means materially risky financial, governed-action, routing, degraded-data, and locale scenarios, not exhaustive visual permutation testing
