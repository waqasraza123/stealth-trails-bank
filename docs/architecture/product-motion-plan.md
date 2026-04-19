# Product Motion Plan

## Summary

Introduce a shared motion language across `apps/web`, `apps/admin`, and `apps/mobile` with an editorial-premium posture:

- customer surfaces feel luminous, spatial, and modern
- admin shares the same family, but with tighter timing and less flourish
- mobile feels tactile and elevated without turning every screen into a spectacle

This motion layer should amplify the existing glass, ledger, and premium typography system rather than replace it.

## Major Surfaces

- Web: auth, dashboard, wallet, transactions, yield
- Admin: console shell, operations overview, launch readiness
- Mobile: sign-in, dashboard, wallet, transactions

## Motion Rules

- fast interactions use short lift, shadow bloom, and press compression
- screen entrances use staggered opacity and vertical settle
- hero surfaces get ambient drift and layered reveal
- status changes prefer soft crossfade over abrupt swaps
- reduced-motion users keep clarity with short fades only

## Implementation Notes

- web and admin use `framer-motion`
- mobile uses `react-native-reanimated`
- timing, easing, delay scale, and ambient cadence come from a shared motion token file in `packages/ui-foundation`
