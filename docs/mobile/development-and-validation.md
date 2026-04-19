# React Native Mobile Development and Validation

## Purpose

This document covers the practical local workflow for running and validating the mobile app in `apps/mobile`.

## Environment

Create `apps/mobile/.env` from `apps/mobile/.env.example`.

Required value:

- `EXPO_PUBLIC_API_BASE_URL`

Local development default:

- iOS simulator or Expo web: `http://localhost:9101`
- Android emulator: `http://10.0.2.2:9101`
- physical device: use a LAN-visible API host on port `9101`

Use a base URL reachable from the target runtime:

- iOS simulator: local machine host is usually fine
- Android emulator: use a reachable host such as `10.0.2.2` when needed
- physical device: use a LAN-visible API host, not `localhost`

## Local commands

From the repository root:

```bash
pnpm dev:mobile
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:export
pnpm mobile:verify
```

## Validation baseline

Before shipping mobile changes, run:

```bash
pnpm mobile:verify
```

Then verify on a simulator or device:

- empty session routes to sign-in
- persisted valid session routes to dashboard
- wallet deposit and withdrawal validation behaves correctly
- transactions render status and timeline data
- yield surfaces policy-gated execution posture correctly
- loans preview and application flows hit the existing API contract

## Notes

- The mobile app reuses the existing API envelope and does not introduce a separate backend contract.
- JWT is stored in secure storage; locale is stored in async storage.
- Money movement remains request-driven and policy-governed; mobile is a client surface over the same backend workflow model as web.
- GitHub Actions runs the same `pnpm mobile:verify` gate in `.github/workflows/mobile-ci.yml`.
