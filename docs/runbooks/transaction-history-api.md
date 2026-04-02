# Transaction History API

## Purpose

This runbook covers the first shared customer-facing history slice across deposit and withdrawal transaction intents.

This slice gives the authenticated customer a single history view over:

- deposits
- withdrawals

It does not mutate money state.

## Customer authentication

These endpoints require standard JWT authentication.

## List my transaction history

Endpoint:

    GET /transaction-intents/me/history?limit=20

Optional filters:

    GET /transaction-intents/me/history?intentType=withdrawal&status=settled&assetSymbol=USDC&limit=20

Expected behavior:

- scopes results to the authenticated customer account only
- includes both deposit and withdrawal transaction intents
- sorts newest first
- default limit is 20
- max limit is 100
- includes:
  - asset metadata
  - source wallet address when present
  - destination wallet address when present
  - external withdrawal address when present
  - latest blockchain transaction when present
  - current status and policy decision
  - requested and settled amounts

## Success condition

A successful history slice should produce:

- one customer-facing timeline across deposits and withdrawals
- no need to query separate product-specific paths for basic history
- enough transaction context for customer support and customer self-service
