# Platform Alert Routing

This runbook covers the Phase 11 alert-routing automation layered on top of durable platform alerts and the internal metrics surface.

It now also includes the governance controls used after routing:
- explicit owner assignment
- operator acknowledgement
- temporary suppression windows
- external delivery targets with durable retryable delivery records
- category-specific automation policies that can auto-route eligible alerts
- failover delivery targets that preserve escalation ancestry

## Endpoints

Single alert to review case:

```http
POST /operations/internal/alerts/:alertId/route-review-case
Content-Type: application/json

{
  "note": "Optional operator routing note"
}
```

Batch route unrouted critical alerts:

```http
POST /operations/internal/alerts/route-critical
Content-Type: application/json

{
  "limit": 10,
  "staleAfterSeconds": 180,
  "note": "Optional shared routing note"
}
```

Authentication:
- internal operator API key headers are required, the same as the other operations endpoints

Ownership:

```http
POST /operations/internal/alerts/:alertId/assign-owner
Content-Type: application/json

{
  "ownerOperatorId": "ops_17",
  "note": "Optional ownership note"
}
```

Acknowledgement:

```http
POST /operations/internal/alerts/:alertId/acknowledge
Content-Type: application/json

{
  "note": "Optional acknowledgement note"
}
```

Suppression:

```http
POST /operations/internal/alerts/:alertId/suppress
Content-Type: application/json

{
  "suppressedUntil": "2026-04-07T12:30:00.000Z",
  "note": "Optional suppression note"
}
```

Clear suppression:

```http
POST /operations/internal/alerts/:alertId/clear-suppression
Content-Type: application/json

{
  "note": "Optional clear note"
}
```

Retry failed deliveries:

```http
POST /operations/internal/alerts/:alertId/retry-deliveries
Content-Type: application/json

{
  "note": "Optional retry note"
}
```

## Behavior

- only open platform alerts can be routed
- routing creates or reuses a `manual_intervention` review case using a reason code derived from the alert dedupe key
- each routing action writes an audit event against the `PlatformAlert`
- matching automation policies can route eligible alert classes with `actorType=system` and a policy-derived routing note
- routed state is persisted on the alert so operators can see whether triage already happened
- owner assignment, acknowledgement, and suppression state are also persisted on the alert
- suppression only mutes the operator handling state; it does not resolve the alert
- matching external delivery targets are enqueued durably and attempted asynchronously
- failed primary deliveries can enqueue failover-only targets that keep escalation level and source-delivery ancestry
- failed deliveries remain replayable through the retry endpoint instead of disappearing into logs
- if a resolved alert later reopens, routing state is reset so the new incident window must be triaged again
- if a resolved alert later reopens, ownership, acknowledgement, and suppression state are reset too
- batch routing only targets open, critical, currently unrouted alerts

## Operational use

Use routed platform alerts to:
- push critical worker, queue, chain, treasury, and reconciliation failures into the operator review queue
- avoid relying on raw logs or ad hoc database queries to prove that triage was opened
- link alert investigation to the existing review-case workflow and audit trail
- make one operator visibly responsible for an active alert
- reduce repeated noise during maintenance or known incidents without losing the durable alert record
- route critical alert classes to external webhook targets by category, severity, and event type
- auto-open investigation work for alert classes that should never wait for a human to click the first routing button

## Next step

After this routing-and-automation baseline:
1. add time-based re-escalation for critical alerts that remain unacknowledged or unowned
2. expose delivery-target health and escalation latency in the operations metrics surface
