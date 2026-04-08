# Platform Alert Delivery Targets

This runbook covers the external delivery slice for governed platform alerts.

## Runtime configuration

Environment variables:

- `PLATFORM_ALERT_DELIVERY_TARGETS_JSON`
- `PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS`
- `PLATFORM_ALERT_AUTOMATION_POLICIES_JSON`
- `PLATFORM_ALERT_DELIVERY_HEALTH_SLO_JSON`
- `PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS`
- `PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS`
- `PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS`
- `WORKER_PLATFORM_ALERT_REESCALATION_INTERVAL_MS`

Example:

```json
[
  {
    "name": "ops-critical",
    "url": "https://ops.example.com/hooks/platform-alerts",
    "bearerToken": "replace-me",
    "deliveryMode": "direct",
    "categories": ["worker", "queue", "chain", "treasury", "reconciliation", "operations"],
    "minimumSeverity": "critical",
    "eventTypes": ["opened", "reopened", "re_escalated", "routed_to_review_case", "owner_assigned"],
    "failoverTargetNames": ["ops-failover"]
  },
  {
    "name": "ops-failover",
    "url": "https://pager.example.com/hooks/platform-alerts",
    "bearerToken": "replace-me-too",
    "deliveryMode": "failover_only",
    "categories": ["worker", "queue", "chain", "treasury", "reconciliation", "operations"],
    "minimumSeverity": "critical",
    "eventTypes": ["opened", "reopened", "re_escalated", "routed_to_review_case", "owner_assigned"]
  }
]
```

Health SLO example:

```json
{
  "lookbackHours": 24,
  "minimumRecentDeliveries": 3,
  "warningFailureRatePercent": 25,
  "criticalFailureRatePercent": 50,
  "warningPendingCount": 2,
  "criticalPendingCount": 5,
  "warningAverageDeliveryLatencyMs": 15000,
  "criticalAverageDeliveryLatencyMs": 60000,
  "warningConsecutiveFailures": 2,
  "criticalConsecutiveFailures": 3
}
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
- overdue critical alerts are re-escalated on a worker-driven timer when they remain unacknowledged or unowned
- deliveries are stored durably before send attempts start
- failed deliveries can be retried from the operator API
- delivery-target health is exposed through the operations API and admin console with recent success, failure, pending, and latency summaries
- sustained delivery-target degradation now opens durable `operations` platform alerts when configured failure-rate, backlog, latency, or consecutive-failure SLO thresholds are breached

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

Timed follow-up also emits a durable `platform_alert.re_escalated` audit event so repeat intervals remain enforced even when no external targets are currently configured.

## Operational use

Use external delivery targets to:

- page or notify external systems when critical alert classes open or reopen
- prove whether an alert was actually sent to an external target
- prove when delivery failed over from one target to another
- separate direct destinations from failover-only destinations in runtime config instead of duplicating notifications
- retry failed external notifications without mutating the underlying alert state

## Next step

After this SLO-backed delivery baseline:
1. prove the worker sweep cadence and delivery-target SLO alerts against staging alert traffic
2. record the resulting proof through `POST /release-readiness/internal/evidence` using `platform_alert_delivery_slo` and `critical_alert_reescalation`
3. attach threshold decisions and residual gaps to the launch checklist before any real launch posture
