# Platform Alert Delivery Targets

This runbook covers the external delivery slice for governed platform alerts.

## Runtime configuration

Environment variables:

- `PLATFORM_ALERT_DELIVERY_TARGETS_JSON`
- `PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS`
- `PLATFORM_ALERT_AUTOMATION_POLICIES_JSON`

Example:

```json
[
  {
    "name": "ops-critical",
    "url": "https://ops.example.com/hooks/platform-alerts",
    "bearerToken": "replace-me",
    "deliveryMode": "direct",
    "categories": ["worker", "queue", "chain", "treasury", "reconciliation"],
    "minimumSeverity": "critical",
    "eventTypes": ["opened", "reopened", "routed_to_review_case", "owner_assigned"],
    "failoverTargetNames": ["ops-failover"]
  },
  {
    "name": "ops-failover",
    "url": "https://pager.example.com/hooks/platform-alerts",
    "bearerToken": "replace-me-too",
    "deliveryMode": "failover_only",
    "categories": ["worker", "queue", "chain", "treasury", "reconciliation"],
    "minimumSeverity": "critical",
    "eventTypes": ["opened", "reopened", "routed_to_review_case", "owner_assigned"]
  }
]
```

Automation example:

```json
[
  {
    "name": "critical-worker-auto-route",
    "categories": ["worker"],
    "minimumSeverity": "critical",
    "autoRouteToReviewCase": true,
    "routeNote": "Escalate worker outages immediately."
  }
]
```

Behavior:

- direct targets are matched by alert category
- targets are matched by minimum severity
- targets are matched by event type
- direct targets can name failover-only targets that are created only after a failed delivery attempt
- failover deliveries keep escalation level and parent-delivery ancestry in the durable record
- category-specific automation policies can auto-route matching alerts into review cases without a manual console action
- deliveries are stored durably before send attempts start
- failed deliveries can be retried from the operator API

## Delivery records

Each matched delivery becomes a durable `PlatformAlertDelivery` record with:

- target name
- target url
- event type
- request payload
- optional parent delivery id and escalation level
- attempt count
- final status
- latest response status or error message

## Operational use

Use external delivery targets to:

- page or notify external systems when critical alert classes open or reopen
- prove whether an alert was actually sent to an external target
- prove when delivery failed over from one target to another
- separate direct destinations from failover-only destinations in runtime config instead of duplicating notifications
- retry failed external notifications without mutating the underlying alert state

## Next step

After this failover-and-automation baseline:
1. add time-based re-escalation when critical alerts remain unacknowledged or unowned
2. expose delivery-target health and escalation latency as explicit platform metrics
