# Stealth Trails Bank — React Native Mobile App Product Spec

## 1) Summary

Build a **customer-facing** mobile app for Stealth Trails Bank that mirrors the current customer web app (`apps/web`) and its production-oriented platform posture:

- **Auth + managed customer account lifecycle** (Supabase identity mapped to platform CustomerAccount; account state gates actions).
- **Ledger-backed balances** (customer balances come from `GET /balances/me`, not from ad hoc chain reads).
- **Transaction-intent workflows** for deposits and withdrawals (request → review/queue/broadcast/confirm/settle; visible statuses + references).
- **Governed product actions** (staking/yield execution can be policy-gated).
- **Operational transparency UX** (clear status badges, timelines, stale-data notices, and reference IDs).

This spec is grounded in repo docs (ADRs, runbooks) and the current implementation in `apps/web` + `apps/api`.

## 2) Goals / Non-goals

### Goals

1. **Feature parity with `apps/web` customer surfaces**:
   - Sign in / sign up
   - Dashboard summary
   - Wallet: supported assets, balances, deposit request + QR, withdrawal request
   - Transactions: history list + detail timeline
   - Yield: staking snapshot + governed actions (deposit/withdraw/claim/emergency)
   - Loans: managed lending surface (dashboard, quote preview, submit application, autopay preference)
   - Profile: account status + lifecycle timestamps, managed wallet detail, password rotation (if allowed), email notification preferences, logout
2. **Mobile-first navigation + UX** that preserves “bank-like” clarity:
   - Bottom-tab primary navigation
   - A consistent “status + reference + timeline” pattern for money movement
3. **Security-appropriate storage**:
   - JWT stored in secure storage (Keychain/Keystore)
   - Locale + non-sensitive preferences in async storage
4. **Operational correctness cues**:
   - Stale-data messaging (balances/history older than expected)
   - Explicit policy gating messaging (yield execution may be unavailable)

### Non-goals (v1)

- Customer self-custody / browser wallet connect flows (explicitly removed in web profile UX).
- Multi-chain support (ADR 001 locks a single-chain product model; Base is the target v1 chain strategy).
- Admin console parity (`apps/admin`) or internal operator tooling.
- Full push notification system (email preferences exist; mobile push can be phased later).

## 3) Product Principles (from repo direction)

1. **Truthful money state**: balances and transaction state are platform-backed (ADR 003; runbooks).
2. **Governed actions**: sensitive workflows show policy posture and review status (ADR 002; yield snapshot includes execution availability + message).
3. **Traceability**: every intent has a stable reference ID; customers can inspect a timeline.
4. **Degraded-mode usability**: if a read model is unavailable, the app should still render shell + actionable guidance rather than blank screens.

## 4) Target Users & Personas

- **Managed customer**: wants safe deposit/withdraw + product usage without managing chain-level details day-to-day.
- **Bilingual user**: needs English + Arabic with correct RTL layout (current web supports `en` and `ar`).

## 5) Platforms, Tech Constraints, and Baseline Stack

### Supported platforms

- iOS and Android.

### Recommended baseline implementation

- **Expo (React Native + TypeScript)** for fast iteration inside Codex and easy device testing.
- Navigation: `@react-navigation/native` with bottom tabs + stacks.
- Data layer: `@tanstack/react-query` + `axios` (mirrors `apps/web` patterns).
- State: `zustand` (mirrors `apps/web`) for session + lightweight preferences.
- Storage:
  - `expo-secure-store` for JWT + (optionally) user profile cache.
  - `@react-native-async-storage/async-storage` for locale.
- Localization:
  - Reuse `packages/i18n` formatting utilities and message catalogs adapted for mobile.
  - Direction handling via `I18nManager` (RTL) + per-screen layout mirroring.

## 6) Repository / Project Strategy

You have two viable ways to build mobile:

### Option A (recommended): Keep monorepo and add `apps/mobile`

Pros:
- Reuse `packages/types`, `packages/i18n`, and shared domain utilities immediately.
- Keep API and web/admin/worker code co-located for fast contract evolution.

Cons:
- Slightly more workspace config for Metro bundler.

### Option B: New standalone mobile repo

Pros:
- Simpler mental model if you truly want “mobile-only”.

Cons:
- You must vendor/copy shared packages (`types`, `i18n`) or publish them.

This spec assumes Option A for implementation efficiency, but includes guidance for a standalone repo in §16.

## 7) API Contracts the Mobile App Must Support

All API responses use a common envelope shape (see `apps/api/src/types/CustomJsonResponse.ts` and web `ApiResponse`):

```ts
type ApiEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
  error?: unknown;
};
```

### Auth

- `POST /auth/signup` (also accepts `/auth/signUp`)
  - Request: `{ firstName, lastName, email, password }`
  - Response: `data.user`
- `POST /auth/login`
  - Request: `{ email, password }`
  - Response: `data.token`, `data.user` (includes `supabaseUserId`, `ethereumAddress`, etc.)
- `PATCH /auth/password` (JWT required)
  - Request: `{ currentPassword, newPassword }`

### Customer profile

- `GET /user/:supabaseUserId` (JWT required, must match token identity)
  - Returns `UserProfileProjection` (see `packages/types/src/user-profile.ts`)
- `PATCH /user/:supabaseUserId/notification-preferences` (JWT required)
  - Request: `{ depositEmails, withdrawalEmails, loanEmails, productUpdateEmails }`

### Assets and balances

- `GET /assets/supported` (JWT required)
- `GET /balances/me` (JWT required)

### Transaction intents (customer)

- `POST /transaction-intents/deposit-requests` (JWT required)
  - Request: `{ idempotencyKey, assetSymbol, amount }`
  - Semantics: creates a deposit intent record only; no broadcast (runbook `docs/runbooks/deposit-intent-request-api.md`)
- `POST /transaction-intents/withdrawal-requests` (JWT required)
  - Request: `{ idempotencyKey, assetSymbol, amount, destinationAddress }`
  - Semantics: creates withdrawal intent and **reserves balance** (available → pending) (runbook `docs/runbooks/withdrawal-intent-request-api.md`)
- `GET /transaction-intents/me/history?limit=...`
  - Optional: `intentType`, `status`, `assetSymbol` (runbook `docs/runbooks/transaction-history-api.md`)

### Yield / staking (customer)

- `GET /staking/me/snapshot` (JWT required)
  - Returns: `CustomerStakingSnapshot` (web hook mirrors this)
- `POST /staking/deposit` `{ poolId, amount }`
- `POST /staking/withdraw` `{ poolId, amount }`
- `POST /staking/claim-reward` `{ poolId }`
- `POST /staking/emergency-withdraw` `{ poolId }`

### Loans (customer)

- `GET /loans/me/dashboard`
- `POST /loans/me/quote-preview`
- `POST /loans/me/applications`
- `POST /loans/me/:loanAgreementId/autopay`

## 8) Session, Storage, and Security Requirements

### JWT handling

- Store JWT in secure storage.
- Attach `Authorization: Bearer <token>` to all authenticated requests (mirrors `apps/web/src/hooks/*`).
- If an API call returns 401/403:
  - clear session
  - navigate to sign-in
  - show an inline “Session expired” message

### User profile handling

- Store “session user” fields:
  - `supabaseUserId`, `email`, `firstName`, `lastName`, `ethereumAddress`
- Treat the **server profile** (`GET /user/:id`) as the truth for:
  - account lifecycle status (`accountStatus`, timestamps)
  - password rotation availability
  - notification preferences

### Idempotency keys

Deposit/withdraw requests require `idempotencyKey`.

Mobile implementation requirement:
- Generate keys in the same spirit as `apps/web/src/lib/customer-finance.ts#buildRequestIdempotencyKey`:
  - prefix (`deposit_req`, `withdraw_req`)
  - sortable timestamp segment
  - random segment
- Ensure idempotency key **re-use** for a retried submit with the same payload signature until success/failure is resolved (web stores last submission signature + key).

Note: React Native doesn’t reliably provide `globalThis.crypto.randomUUID` on all runtimes; use a dedicated UUID/crypto helper (Expo has `expo-crypto`; otherwise use `uuid`).

### Locale storage

- Persist locale (`en`/`ar`) in async storage.
- Apply RTL layout when `ar` is selected.

## 9) Localization & RTL

### Supported locales

- `en` and `ar` (mirrors `packages/i18n` + `apps/web/src/i18n/messages/*`).

### RTL requirements

- All screens must render correctly in RTL:
  - tab order and row layouts mirror appropriately
  - addresses and reference IDs remain LTR-safe using bidi isolation equivalents (in RN, prefer explicit `textAlign` + `writingDirection` and use `unicode-bidi`-like patterns where possible; at minimum wrap addresses in dedicated components that force LTR)

### Translation catalogs

Two approaches:

1. **Port existing web catalogs** into a mobile message catalog (fastest; keeps copy parity).
2. Introduce a shared `packages/messages` later, if both web and mobile must stay in sync long term.

## 10) Navigation Model (Mobile)

### App entry

- Splash → Session bootstrap → route:
  - If JWT exists: load minimal profile (`GET /user/:id`) and land on Dashboard.
  - Else: land on Sign In.

### Primary navigation (bottom tabs)

- Dashboard
- Wallet
- Yield
- Transactions
- Profile

Loans is accessible via:
- a secondary entry from Dashboard (CTA) and/or Profile (menu item), matching web’s “Managed loans” secondary button.

## 11) Screen-by-Screen Product Requirements

Each screen must implement: loading state, error state, empty state (where relevant), and localization/RTL support.

### 11.1 Sign In

Purpose: Authenticate and establish a managed session.

UI:
- Email + password inputs
- Submit button
- Link to Sign Up
- Optional “demo credentials” helper in **dev builds only** (web includes shared login UI copy)

Behavior:
- Call `POST /auth/login`
- On success:
  - persist JWT
  - persist basic user shape
  - navigate to Dashboard
- On failure:
  - show inline error and toast/snackbar

### 11.2 Sign Up

Purpose: Create a managed customer identity.

Behavior:
- Call `POST /auth/signup`
- On success: route to Sign In (web does not auto-login after signup)
- On failure: show inline error + toast

### 11.3 Dashboard

Purpose: A bank-like summary of account posture, balances, and recent money movement.

Data:
- `GET /balances/me`
- `GET /transaction-intents/me/history?limit=5`

Content (mirror web intent):
- Summary counts:
  - number of tracked assets
  - number of assets with pending balances (`pendingBalance > 0`)
  - number of recent intents
- “Stale operational snapshot” notice if balances/history are older than 24h (web uses `isTimestampOlderThan(..., 24)`).
- Recent intents preview (top 3) with:
  - type (deposit/withdrawal)
  - amount (requested or settled)
  - status badge (confidence tone)
  - created-at

Actions:
- Navigate to Transactions (full history)
- Navigate to Wallet (deposit/withdraw entry)

### 11.4 Wallet (Balances + Deposit + Withdraw)

Purpose: Show ledger-backed balances and enable request creation for deposit/withdraw intents.

Data:
- `GET /assets/supported`
- `GET /balances/me`

#### Balances section

- List each asset with:
  - available balance
  - pending balance
  - updated-at label
- Show stale notice if `updatedAt` is older than 24h.

#### Deposit request

Inputs:
- Asset selector (from supported assets)
- Amount input

Pre-submit validations (client-side, matching web):
- Managed wallet address must exist (from session user/profile)
- Asset selected
- Amount is a positive decimal string

Submit:
- `POST /transaction-intents/deposit-requests`
- On success:
  - show “idempotency reused” vs “created” messaging
  - display “Latest deposit request” tracker:
    - reference ID
    - created at
    - status badge
    - timeline events (see §12)

Deposit address display:
- Show managed wallet address
- “Copy” action
- QR code toggle (mobile: show QR inline or as a modal; use a RN QR component)

#### Withdrawal request

Inputs:
- Asset selector
- Destination address input
- Amount input

Pre-submit validations:
- Asset selected
- Destination is valid EVM address
- Destination != managed wallet address
- Amount is positive decimal
- Amount <= available balance for selected asset

Submit:
- `POST /transaction-intents/withdrawal-requests`
- On success:
  - same tracker pattern as deposit
  - note that pending balance increases immediately (runbook)

### 11.5 Transactions (History + Detail)

Purpose: A single customer-facing view across deposits and withdrawals (runbook).

Data:
- `GET /transaction-intents/me/history?limit=100`

List UI:
- Rows show: type, amount, date, resolved address, status badge
- Search filters (mobile-friendly):
  - search bar matches type/amount/address/asset/ref
  - optional filter chips for type and status (web has type/status dropdowns)

Detail UI:
- Open a right-side sheet on web; on mobile use:
  - a full-screen modal or bottom sheet
- Show:
  - amount + created date
  - reference ID
  - resolved address
  - chain hash (if present)
  - timeline events

### 11.6 Yield (Staking)

Purpose: Present a governed yield surface with explicit policy posture.

Data:
- `GET /staking/me/snapshot`

Snapshot content:
- Execution posture:
  - `execution.available`
  - `execution.reasonCode`
  - `execution.message`
- Read model posture:
  - `readModel.available`
  - `readModel.message`
- Pools list and selected pool details:
  - reward rate
  - total staked / rewards paid
  - user position: staked balance, pending reward, `canReadPosition`

Actions (only enabled when `execution.available`):
- Deposit: `POST /staking/deposit` with amount validation
- Withdraw: `POST /staking/withdraw` with amount validation
- Claim reward: `POST /staking/claim-reward`
- Emergency withdraw: `POST /staking/emergency-withdraw`

UX rules:
- If execution is gated: keep controls visible but disabled; show the gating message prominently.
- If read model is limited: show a non-blocking notice and degrade position display.

### 11.7 Loans (Managed Lending)

Purpose: Provide the customer managed lending workflow with explicit disclosures and governed posture.

Data:
- `GET /loans/me/dashboard`

Dashboard content:
- Eligibility + reasons
- Policy packs per jurisdiction (USA/UAE/Saudi Arabia) and disclosure details
- Borrowing capacity (ETH/USDC)
- Existing applications and agreements with timelines

Actions:
- Quote preview (`POST /loans/me/quote-preview`) using:
  - jurisdiction, borrow/collateral assets, amounts, term, autopayEnabled
- Submit application (`POST /loans/me/applications`) with disclosure acknowledgement
- Set autopay preference (`POST /loans/me/:loanAgreementId/autopay`)

Mobile UX adaptation:
- Use a step-based flow for new application:
  1) Configure quote inputs
  2) Preview quote + disclosure
  3) Confirm acknowledgements + optional support note
  4) Submit
- Agreement detail uses tabs/accordion:
  - overview
  - schedule/installments
  - collateral positions
  - timeline

### 11.8 Profile

Purpose: Show managed account state, custody posture, security controls, and preferences.

Data:
- `GET /user/:supabaseUserId`

Content:
- Account status badge and summary (web uses `accountStatus` + helper copy)
- IDs:
  - customer ID (may be null / “not provisioned”)
  - Supabase user ID
- Managed wallet address (read-only)
- Security controls:
  - identity state summary
  - password rotation availability
  - notification preferences availability

Actions:
- Rotate password (if `passwordRotationAvailable`):
  - validate confirm password matches
  - `PATCH /auth/password`
- Notification preferences (if available):
  - toggles for deposit/withdrawal/loan/product updates
  - `PATCH /user/:id/notification-preferences`
- Logout:
  - clear token + user from storage
  - navigate to Sign In

## 12) Statuses, Tones, and Timelines

### Transaction intent statuses (customer-visible)

Mobile must support displaying at least the statuses already used in the web type:

- `requested`
- `review_required`
- `approved`
- `queued`
- `broadcast`
- `confirmed`
- `settled`
- `failed`
- `cancelled`
- `manually_resolved`

### Confidence/tone mapping

The web uses `@stealth-trails-bank/ui-foundation` helpers:
- `mapIntentStatusToConfidence`
- `getTransactionConfidenceTone`
- `getTransactionConfidenceLabel`
- `buildIntentTimeline`

Recommendation:
- Reuse these pure helpers in mobile (do not duplicate mapping logic).
- Render a consistent badge component using the derived tone:
  - `neutral`, `positive`, `warning`, `critical`, `technical`

### Timeline rendering

Every intent detail view and “latest request tracker” must render:
- ordered events
- timestamps where present
- optional metadata (reference ID, chain hash)

## 13) Error Handling and Degraded Modes

Requirements:
- Keep shell visible on errors; show inline notices where the user expects data.
- Provide actionable copy:
  - “Auth token is required” should not leak directly; show “Please sign in again.”
  - API error `message` should be surfaced when safe and user-actionable.
- For network failures:
  - show retry controls on key screens (balances, history, staking snapshot, loans dashboard).

## 14) Observability (App-side)

Even if backend observability is robust, mobile should emit client events (Phase 2+):

Suggested event names:
- `auth_login_success`, `auth_login_failed`
- `intent_deposit_create_success`, `intent_deposit_create_failed`
- `intent_withdraw_create_success`, `intent_withdraw_create_failed`
- `staking_deposit_success` / `_failed` (same for withdraw/claim/emergency)
- `loans_quote_preview_success` / `_failed`, `loans_application_submit_success` / `_failed`

At minimum for v1: structured console logging in dev builds and a simple “report error” placeholder hook.

## 15) Acceptance Criteria (v1)

The mobile app is considered v1-complete when:

- A user can sign up and sign in.
- Dashboard renders balances + recent activity for an authenticated user.
- Wallet shows supported assets + balances and can create:
  - deposit requests (with QR + copy address)
  - withdrawal requests (with validation against available balance)
- Transactions shows history and opens detail timeline.
- Yield screen renders snapshot and correctly gates actions; actions succeed when allowed.
- Profile shows account lifecycle state, allows logout, and:
  - rotates password when available
  - edits notification preferences when available
- Locale switching works for `en` and `ar`, with correct RTL layout.

## 16) Fork / “Delete backend + contracts” Feasibility Assessment

### Can you “convert the existing React app to React Native” by keeping only React files?

Partially, but not directly:

- `apps/web` is **React (web)** built on Vite + Tailwind + Radix + DOM primitives.
- React Native does not support DOM elements (`div`, `input`, etc.) or CSS the same way.
- Many components under `apps/web/src/components/ui/*` are web-specific wrappers (Radix, HTML inputs, CSS classes).

What *is* reusable with minimal change:

- Domain types: `packages/types`
- Formatting + locale utilities: `packages/i18n` (document helpers are web-only, but formatter/translator are reusable)
- Some pure finance helpers: parts of `apps/web/src/lib/customer-finance.ts` (replace `crypto.randomUUID` dependency)
- API call patterns and response envelopes (translate hooks to RN environment)
- Confidence/timeline helpers in `packages/ui-foundation` (pure TS)

What must be rewritten:

- UI component layer (inputs, cards, sheets, tables, toasts, tooltips)
- Navigation (react-router → react-navigation)
- Styling (tailwind/css utilities → RN styles or NativeWind)

### Recommended “forking” approach if you still want a mobile-only repo

If you fork on GitHub and want a mobile-only repo:

1. Fork the repo (`waqasraza123/stealth-trails-bank`) in GitHub.
2. Create a new Expo app at repo root (or keep as `apps/mobile`).
3. Keep these directories initially:
   - `packages/types`
   - `packages/i18n`
   - `packages/config` (you may add a mobile runtime config module)
   - `packages/ui-foundation`
4. Delete (or archive) unrelated boundaries only after mobile boots:
   - `apps/api`, `apps/worker`, `apps/admin`, `packages/contracts*`, `packages/db`, etc.

Important: If you delete backend/contracts, you lose the local dev stack; you’ll need a deployed API to build against.

#### Practical fork commands (GitHub CLI)

If you use the GitHub CLI (`gh`), the simplest path is:

```bash
# one-time login
gh auth login

# fork + clone
gh repo fork waqasraza123/stealth-trails-bank --clone

cd stealth-trails-bank
```

From there you can either:

- keep the monorepo and add `apps/mobile`, or
- create a new branch that deletes non-mobile boundaries and force-push it as the new default (not recommended until mobile is stable).

### Best path when working in Codex right now

Start with **Option A** (add `apps/mobile`), keep the backend in-repo for local iteration, and only later decide whether to split mobile into a standalone repo.

## 17) Greenfield Bootstrap Checklist (New Repo From Scratch)

If you decide **not** to fork and instead start a brand-new repo:

1. Create an Expo app:
   - `npx create-expo-app@latest stealth-trails-bank-mobile --template`
2. Add dependencies to mirror web behavior:
   - `@tanstack/react-query`, `axios`, `zustand`
   - `@react-navigation/native` + required native deps
   - `expo-secure-store`, `@react-native-async-storage/async-storage`
3. Copy or vendor shared code from this repo:
   - `packages/types/src/*` (or just `user-profile.ts` and `loans.ts` initially)
   - `packages/i18n/src/*` (omit `document.ts` or guard it behind web-only checks)
   - `packages/ui-foundation/src/index.ts` (for confidence/timeline helpers)
4. Define a single config value:
   - `EXPO_PUBLIC_API_BASE_URL=https://...`
5. Implement screens in the same order as §11:
   - Auth → Dashboard → Wallet → Transactions → Yield → Profile → Loans
