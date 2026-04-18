# Stealth Trails Bank

[![License](https://img.shields.io/github/license/waqasraza123/stealth-trails-bank)](LICENSE)

![PNPM](https://img.shields.io/badge/pnpm-9.15.0-F69220?logo=pnpm&logoColor=fff)
![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444?logo=turborepo&logoColor=fff)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=fff)
![Playwright](https://img.shields.io/badge/Playwright-E2E-45BA4B?logo=playwright&logoColor=fff)
![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?logo=ethereum&logoColor=fff)
![Solidity](https://img.shields.io/badge/Solidity-363636?logo=solidity&logoColor=fff)
![Blockchain](https://img.shields.io/badge/Blockchain-121D33?logo=blockchaindotcom&logoColor=fff)
![Decentralized](https://img.shields.io/badge/Decentralized-Web3-6E56CF?logo=web3dotjs&logoColor=fff)
![React Native](https://img.shields.io/badge/React%20Native-20232A?logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-SDK%2055-000020?logo=expo&logoColor=fff)

## Screenshots

![alt text](<.github/screenshots/Screenshot 2026-04-10 at 8.58.46 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 8.59.31 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 8.59.40 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 8.59.50 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 9.00.14 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 9.00.32 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 9.00.47 PM.jpg>) ![alt text](<.github/screenshots/Screenshot 2026-04-10 at 9.00.57 PM.jpg>)

## Overview

Stealth Trails Bank is a monorepo for a blockchain-backed banking platform with:

- customer web and mobile applications
- a backend API with governed money-movement workflows
- an internal admin console for operator controls
- an async worker for blockchain execution and monitoring
- shared packages for config, types, security, contracts, and i18n

The codebase is no longer a prototype shell. It already contains real customer account lifecycle, wallet ownership, deposit and withdrawal intent workflows, ledger-backed balance reads, internal review controls, worker execution paths, auditability, and release-readiness infrastructure.

## Current status

- Phase 1 is complete at the repo-boundary level.
- Phases 2, 3, 6, 8, 9, and 10 are materially advanced or complete in live code.
- Phase 11 observability and incident safety is materially advanced.
- Phase 12 security hardening and release readiness has begun, but final staged proof remains outstanding.

Current execution frontier:

- Phase 11/12 boundary hardening

Immediate next step:

- run the remaining staged drills and release-readiness evidence flow for delivery-target SLOs, critical alert re-escalation, restore and rollback, secret handling, role review, and governed launch approval

## Implemented product surfaces

- Customer web app with auth, dashboard, wallet, yield, transactions, profile, and lending surfaces
- Customer mobile app in `apps/mobile` with Expo + React Native covering the same primary customer surfaces
- Backend API for customer identity, balances, transaction intents, staking, loans, audit, and release-readiness workflows
- Admin console for review queues, oversight, hold/release, reconciliation mismatch, governed export, treasury visibility, and audit-log workflows
- Worker runtime with synthetic, monitor, and managed execution modes, heartbeat reporting, scheduled scans, and execution monitoring

## Current workflow coverage

- customer auth and account lookup
- managed wallet ownership and customer profile projection
- supported assets and ledger-backed customer balances
- deposit and withdrawal intent request flows with review and execution state
- transaction history, reference IDs, and status timelines
- staking/yield snapshot and governed mutation paths
- customer loan dashboard, quote preview, application submission, and autopay preferences
- internal review cases, oversight incidents, hold governance, governed exports, and release-approval workflows
- durable audit trails, platform alerts, metrics surfaces, and release-readiness evidence tracking

## Repository layout

| Path                     | Purpose                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| `apps/admin`             | Internal operator console for review, oversight, and governed export workflows   |
| `apps/web`               | Customer-facing web application                                                  |
| `apps/mobile`            | Customer-facing mobile app (Expo + React Native)                                 |
| `apps/api`               | Backend API, workflow orchestration, persistence, and internal operational paths |
| `apps/worker`            | Async worker runtime for internal execution and blockchain monitoring            |
| `packages/config`        | Shared runtime config loading and validation                                     |
| `packages/contracts-sdk` | Shared ABI ownership, chain adapters, and contract integration helpers           |
| `packages/db`            | Shared Prisma client access                                                      |
| `packages/security`      | Shared header/auth hardening helpers and other reusable security utilities       |
| `packages/types`         | Shared TypeScript contracts and types                                            |
| `packages/contracts`     | Hardhat contracts package and contract tests                                     |
| `docs/`                  | Architecture, ADRs, runbooks, and operational notes                              |

## How the system is shaped

At a high level:

1. customers interact with the platform through the web app and API
2. the API owns customer identity, wallet linkage, workflow state, and persistence
3. internal operator paths review sensitive actions, manage holds, and govern exports
4. internal worker paths monitor and move approved actions through execution state
5. audit events provide a durable operational trail
6. later slices extend this into confirmation, settlement, and broader accounting truth

The direction of the repo is intentional:

- workflow correctness first
- durable persistence and auditability next
- UI and operational visibility layered on top
- correctness over speed in money-critical areas

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

### 1a. Mobile app (React Native / Expo)

The mobile app lives at `apps/mobile` and expects:

- `EXPO_PUBLIC_API_BASE_URL` (see `apps/mobile/.env.example`)

```bash
pnpm dev:mobile
```

### 2. Prepare environment files

Use the existing example env files inside each app or package where present.

At minimum, the API needs working values for:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRY_SECONDS`
- `PRODUCT_CHAIN_ID`
- `INTERNAL_OPERATOR_API_KEY`
- `INTERNAL_WORKER_API_KEY`

For blockchain-connected flows you will also need:

- `RPC_URL`
- `ETHEREUM_PRIVATE_KEY`

For contract-connected flows where relevant:

- `STAKING_CONTRACT_ADDRESS`

Frontend environment values should be configured from the web app env examples where present and pointed at the local or deployed API.

For mobile development, create `apps/mobile/.env` from `apps/mobile/.env.example` and point it at a reachable API base URL for your simulator or device.

### 3. Generate Prisma client and run database migrations

```bash
pnpm --filter @stealth-trails-bank/api prisma:generate
pnpm --filter @stealth-trails-bank/api prisma:migrate
```

### 4. Start local development

```bash
pnpm dev
```

`pnpm dev` now runs a repo-owned preflight first. It fails fast if the worker is pointed at the wrong local API URL or if your local API database is behind the checked-in Prisma migrations.

If that preflight blocks startup, the usual recovery path is:

```bash
pnpm --filter @stealth-trails-bank/api prisma:deploy
```

## Common commands

Run these from the repository root unless noted otherwise.

### Root commands

| Command                                   | Purpose                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                                | Start repo development tasks                                        |
| `pnpm dev:preflight`                      | Validate local dev wiring and Prisma migration state before startup |
| `pnpm build`                              | Build workspace packages that define a build script                 |
| `pnpm test`                               | Run workspace tests                                                 |
| `pnpm lint`                               | Run lint tasks where defined                                        |
| `pnpm compile`                            | Run compile tasks where defined                                     |
| `pnpm release:readiness:probe -- --help`  | Run a Phase 12 drill probe and optionally record evidence           |
| `pnpm release:readiness:verify -- --help` | Run Phase 12 automated proof suites or manual review attestations   |
| `pnpm dev:mobile`                         | Start the Expo mobile app                                           |
| `pnpm mobile:ios`                         | Open the Expo app in an iOS simulator                               |
| `pnpm mobile:android`                     | Open the Expo app in an Android emulator                            |
| `pnpm mobile:test`                        | Run the mobile Jest suite                                           |
| `pnpm push --validate-before-push`        | Run repo push validation and push only if it passes                 |
| `pnpm safe-push`                          | Alias for `pnpm push --validate-before-push`                        |

### Package-scoped examples

```bash
pnpm --filter @stealth-trails-bank/web dev
pnpm --filter @stealth-trails-bank/api start:dev
pnpm --filter @stealth-trails-bank/api prisma:generate
pnpm --filter @stealth-trails-bank/api prisma:migrate
pnpm --filter @stealth-trails-bank/api prisma:deploy
```

## Documentation map

Use these docs first when working in the repo:

- `docs/architecture/target-system.md`
- `docs/architecture/production-roadmap.md`
- `docs/architecture/critical-feature-e2e-plan.md`
- `docs/architecture/data-model-target.md`
- `docs/architecture/schema-transition-plan.md`
- `docs/mobile/react-native-product-spec.md`
- `docs/mobile/react-native-implementation-plan.md`

Use the runbooks when operating or verifying implemented flows:

- wallet projection and repair runbooks under `docs/runbooks/`
- deposit intent request, operator review, and execution runbooks
- manual review and audit summary runbooks
- release readiness evidence, release-candidate verification, launch approval, and rollback drill runbooks

## Engineering standards for this repo

The project is being developed with a production-grade bias.

That means contributions should aim for:

- small focused modules
- descriptive names
- strong typing
- explicit validation
- durable auditability for important state changes
- safe idempotent workflow behavior
- no hidden magic around money state
- readable code over clever code

For money-moving or state-critical changes, always prefer:

- explicit state transitions
- durable persistence
- audit visibility
- recovery-safe behavior

## Production posture

This repository should be treated as a product codebase, not a demo template.

A change is not production-grade here just because it works locally. It should also be:

- reviewable
- testable
- recoverable
- operationally understandable
- safe to extend later

For that reason, some parts of the repo will look more deliberate than move fast prototypes. That is by design.

## Security note

This repo contains financial workflow logic and blockchain-connected code.

Do not:

- commit secrets
- commit real private keys
- expose internal operator or worker keys
- treat prototype defaults as production-safe settings

Please read `SECURITY.md` before reporting issues or handling sensitive findings.

## Collaboration

Please read these files before opening major changes:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## License

This repository is currently distributed under a proprietary license. See `LICENSE`.

If you later decide to open-source all or part of the repo, the license can be changed intentionally instead of by accident.
