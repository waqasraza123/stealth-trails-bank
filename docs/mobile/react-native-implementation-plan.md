# React Native Implementation Plan

## Summary

Build a new Expo-managed app at `apps/mobile` inside the monorepo, using NativeWind for styling and aiming for full customer-surface parity with `apps/web` in the first release. The app will reuse shared domain packages (`packages/types`, `packages/i18n`, `packages/ui-foundation`) and add a mobile runtime-config entrypoint in `packages/config` for API base URL loading.

Implementation order:

1. App scaffold and workspace integration
2. Session, API, i18n, and navigation shell
3. Core customer flows: auth, dashboard, wallet, transactions, profile
4. Product flows: yield and loans
5. Test coverage, device docs, and release hardening

## Key Changes

### Workspace and app shell

- Add `apps/mobile` as an Expo TypeScript app with Expo-managed workflow, React Navigation, React Query, Zustand, Secure Store, Async Storage, NativeWind, and a QR library compatible with Expo.
- Add root/package scripts for mobile development and targeted CI checks:
  - `pnpm --filter @stealth-trails-bank/mobile dev`
  - `ios`
  - `android`
  - `test`
- Add `packages/config/mobile.ts` exporting `loadMobileRuntimeConfig(env)` with `apiBaseUrl` sourced from `EXPO_PUBLIC_API_BASE_URL`.
- Keep mobile-only hooks, screens, and API adapters inside `apps/mobile`; only extract shared pure helpers if both web and mobile need the exact same logic.

### App architecture

- Root flow:
  - bootstrap locale from Async Storage
  - bootstrap session from Secure Store
  - if token exists, fetch `/user/:supabaseUserId`; on success enter main app, on 401/403 clear session and route to sign-in
- Navigation:
  - `AuthStack`: Sign In, Sign Up
  - `MainTabs`: Dashboard, Wallet, Yield, Transactions, Profile
  - `LoansStack` reachable from Dashboard CTA and Profile entry, not a bottom tab
- Data layer:
  - single axios client with auth header injection from session store
  - global 401/403 handling clears session and resets navigation
  - React Query for all reads/mutations; invalidate balances/history/profile/staking/loans queries after successful mutations
- State:
  - Zustand store for session user, token, bootstrap status, locale, and last idempotent submit signature/key pairs for deposit/withdraw retry reuse
- Localization:
  - mobile i18n provider reusing `packages/i18n` formatters/translators
  - mobile message catalog copied from current web catalog on first pass
  - explicit RTL handling for layout mirroring; addresses/reference IDs rendered in dedicated LTR-safe components

### Screen implementation

- Auth:
  - Sign In and Sign Up parity with web behavior
  - dev-only shared-login helper behind Expo dev flag, not enabled in production
- Dashboard:
  - balances summary, pending asset count, recent intent list, stale-data notice, CTA into Wallet/Transactions/Loans
- Wallet:
  - supported assets + ledger-backed balances
  - deposit request form with idempotency-key reuse, address copy, QR display, latest-request tracker, timeline
  - withdrawal request form with asset/address/amount validation, insufficient-balance check, latest-request tracker, timeline
- Transactions:
  - history query with local search/type/status filters
  - detail screen/modal with internal reference, resolved address, chain hash, timeline
- Profile:
  - account lifecycle/status summary
  - managed wallet details
  - password rotation flow if enabled
  - notification preferences form if enabled
  - logout
- Yield:
  - staking snapshot, execution posture, read-model limitation notice, pool selector, deposit/withdraw/claim/emergency actions with disabled-state policy gating
- Loans:
  - dashboard, eligibility, policy packs, applications/agreements
  - quote-preview flow
  - application submission flow with disclosure acknowledgement
  - autopay update for agreements

### Public interfaces and contracts

- New config interface:
  - `packages/config/mobile.ts`
  - `type MobileRuntimeConfig = { apiBaseUrl: string }`
- App-local API envelope:
  - reuse the existing `status/message/data/error` server contract exactly; no API contract changes
- App-local utility contracts:
  - `buildRequestIdempotencyKey(prefix)`
  - `isPositiveDecimalString`
  - `compareDecimalStrings`
  - `isEthereumAddress`
  - `formatShortAddress`
  - `formatTokenAmount`
- Reuse `packages/ui-foundation` for:
  - intent confidence mapping
  - status tone mapping
  - stale timestamp checks
  - relative time
  - timeline generation

## Test Plan

- Set up `jest-expo` and `@testing-library/react-native`; do not add Detox in the initial implementation.
- Add unit tests for:
  - session bootstrap and 401 logout behavior
  - idempotency-key reuse logic
  - decimal/address validation helpers
  - locale switching and RTL-safe address rendering helpers
- Add screen/integration tests for:
  - sign-in success/failure
  - dashboard stale-data and error rendering
  - deposit submit success and API failure
  - withdrawal validation failures and success path
  - transactions detail timeline rendering
  - profile password/preferences flows
  - yield execution-gated vs enabled states
  - loans quote preview and application submit flow
- Acceptance validation on simulator/device:
  - boot with empty session routes to auth
  - boot with valid persisted session routes to dashboard
  - all authenticated screens function against the existing API without contract changes

## Assumptions and defaults

- Repo shape is `apps/mobile` in the existing monorepo.
- Expo managed workflow is the default; no bare React Native or Expo prebuild-specific native customization in v1.
- Full parity means the first production-ready milestone includes Yield and Loans, not a staged omission.
- NativeWind is the styling system; theme tokens live in the app and are consumed through class-based styling plus small shared primitives.
- Mobile will reuse shared packages where they are already pure and stable, but will not block on a broad refactor of `apps/web` internals into packages.
- API base URL is environment-driven through `EXPO_PUBLIC_API_BASE_URL`; local simulator/device setup is documented rather than hardcoded.
