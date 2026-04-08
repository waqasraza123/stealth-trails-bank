# Contributing to Stealth Trails Bank

Thanks for contributing.

This repository is an active product codebase for a financial platform, so the standard for changes is higher than a typical side project. The goal is not only to make things work, but to make them safe to operate, review, and extend.

## Before you start

Please read:

- `README.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- relevant architecture docs under `docs/architecture/`
- relevant runbooks under `docs/runbooks/`

If your change touches a specific flow, read the runbook for that flow first.

## What good contributions look like here

We prefer changes that are:

- small but meaningful
- clearly scoped
- typed and validated
- easy to review
- operationally understandable
- safe to extend later

We do not want changes that:

- mix unrelated concerns
- hide behavior in large multi-purpose files
- introduce silent side effects
- bypass validation for convenience
- weaken auditability around state changes
- make money state harder to reason about

## Development principles

When contributing, aim for:

- descriptive and consistent naming
- small focused functions and modules
- reusable code where it helps clarity
- explicit assumptions
- strong error handling
- production-grade behavior from the start
- no hardcoded secrets or environment-sensitive hacks

For financial or workflow state changes, prefer:

- explicit state transitions
- idempotent behavior where appropriate
- durable persistence
- audit visibility
- recovery-safe logic

## Branching

Use short, descriptive branch names.

Examples:

- `feat/deposit-execution-slice`
- `fix/wallet-projection-audit-summary`
- `docs/repo-governance-docs`

## Commit messages

Commit messages should be:

- short
- specific
- scoped to one meaningful unit of work

Examples:

- `add deposit intent execution slice`
- `add wallet projection audit summary`
- `upgrade repo docs and governance files`

## Pull request expectations

A pull request should explain:

- what changed
- why it changed
- what assumptions were made
- how it was verified
- what follow-up work remains, if any

Good PRs are easier to review and merge when they avoid hidden context.

## Database and Prisma changes

If your change touches schema or persistence:

- update the Prisma schema carefully
- generate Prisma client changes
- run migrations locally
- verify read and write paths
- verify that existing flows still behave correctly

For important state changes, include tests or clear verification steps.

## API changes

If your change adds or changes API behavior:

- validate request payloads
- keep response shapes consistent
- handle failure states explicitly
- update or add a runbook when the flow matters operationally

## Tests

Run the most relevant tests for your change.

Typical examples:

~~~bash
pnpm --filter @stealth-trails-bank/api build
pnpm --filter @stealth-trails-bank/api test
~~~

If your change is bounded, run at least the focused tests around that area.

## Push guard

This repo includes a versioned pre-push guard so broken builds or failing tests do not get pushed.

Enable it once per clone:

~~~bash
pnpm setup:hooks
~~~

After that, normal `git push` runs the repo's push verification automatically.

The enforced verification is:

~~~bash
pnpm build
pnpm test
~~~

If you want one explicit command that works well from terminal-driven AI tools too, use:

~~~bash
pnpm safe-push
~~~

That command runs the same verification and only pushes if it passes.

## Documentation

Update docs when you change:

- architecture assumptions
- workflow behavior
- operational procedures
- onboarding or setup steps
- repo standards

At minimum, update the runbook for any new operational flow.

## Security and sensitive issues

Do not open public issues or casual PR discussion for security-sensitive findings.

Follow the instructions in `SECURITY.md`.

## Questions and collaboration

If a change is large or architectural, align the direction first before spreading work across many files.

The best collaboration here is usually:

- clarify scope
- land one clean vertical slice
- verify it properly
- then move to the next slice

That keeps the repo moving without losing control.
