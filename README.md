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

## Description

Stealth Trails Bank is a monorepo for a blockchain-backed banking platform.

This repository is not only a website and an API. It is the working product codebase for a system that is moving from prototype banking flows into a production-grade platform with:

- customer identity and account lifecycle
- wallet ownership and projection repair tooling
- transaction intent workflows
- internal operator review paths
- internal worker execution paths
- blockchain transaction tracking
- durable auditability around important state transitions

The repo is being built in controlled stages so the platform can move forward without losing correctness in the areas that matter most for money movement.

## What exists today

The repository already includes real backend foundation for:

- customer, customer account, and wallet projections
- migration, audit, and repair tooling for legacy to new model adoption
- customer balance read models and early ledger posting coverage
- deposit and withdrawal transaction intent request, review, and replay-safe workflow slices
- internal operator review cases, oversight incidents, and account hold governance
- operator queueing, settlement reconciliation, and incident package release governance
- async worker runtime with synthetic, monitor, and managed execution modes
- worker heartbeat, scheduled reconciliation scanning, and scan history reporting
- customer web flows backed by real APIs for auth, dashboard, wallet, profile, yield, and transaction history
- internal admin console for review, oversight, hold-release, and export-governance workflows
- durable audit trails across those implemented workflow slices

That means the project has moved beyond pure scaffolding. It now contains early but real money-state workflow slices.

## What is still in progress

This is not yet a finished banking product.

The system still needs broader production coverage in areas such as:

- broader confirmation and settlement automation
- generalized ledger coverage across more money flows
- deeper reconciliation, replay, and operator repair safety
- fuller custody execution coverage for withdrawals and treasury operations
- completion of remaining customer settings and release-hardening gaps
- broader internal admin coverage for treasury, reconciliation, and audit operations
- broader observability, incident tooling, and release hardening

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

## Current implemented flow coverage

The implemented slices today go beyond the initial deposit path and now cover:

1. customer auth, account lookup, balances, wallet, yield, and transaction history reads
2. deposit and withdrawal intent request flows with operator review paths
3. queueing, replay, reconciliation, and settlement handling across transaction intent slices
4. internal review cases, manual resolution governance, and oversight incident workflows
5. account hold placement and release review workflows
6. worker broadcast, monitoring, and managed execution coverage for approved deposit work
7. governed customer incident package exports and release approvals
8. internal admin UI coverage for the review, oversight, hold-release, and export-governance loops

This is important because it means the repo is no longer only a prototype shell. It already contains real workflow state, internal review, internal execution reporting, and auditability.

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
