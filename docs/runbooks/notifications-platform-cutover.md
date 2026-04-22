# Notifications Platform Cutover

## Scope

This runbook covers the fresh-start notifications cutover that replaces the legacy notification cursor projector with transactional domain publishing, recipient delivery sequencing, and websocket resume support.

Release scope:

- in-app and email channels only
- separate customer and operator feeds
- websocket realtime for web, admin, and mobile
- no historical backfill

## Migration Effect

The Prisma migration `20260422190000_harden_notifications_realtime_cutover` does all of the following:

- drops `NotificationDeliveryCursor`
- creates `NotificationRecipientState`
- creates `NotificationSocketSession`
- adds `deliverySequence` to `NotificationFeedItem`
- clears existing `NotificationFeedItem` and `NotificationEvent` rows

This is intentional. After deploy, notification inboxes should only contain events created by post-cutover domain mutations.

## Deployment Order

1. Apply the Prisma migration.
2. Deploy the API.
3. Deploy web, admin, and mobile clients.
4. Verify websocket connectivity and post-deploy event creation.

Do not deploy clients before the API and schema are live. The new clients expect:

- `POST /notifications/me/socket-session`
- `POST /notifications/internal/me/socket-session`
- websocket resume envelopes with delivery sequencing
- matrix-only notification preferences under `/notifications/.../preferences`

## Verification Checklist

Run these checks in a real environment after deploy:

1. Sign in as a customer in web and mobile and confirm both clients receive a valid socket session.
2. Trigger a customer domain event after deploy, such as a deposit request, withdrawal request, or internal transfer.
3. Confirm the new inbox item appears only once and unread counts advance consistently across both clients.
4. Refresh one client, resume the websocket session, and confirm no duplicate item appears.
5. Sign in as an operator in admin, trigger an operator-facing event, and confirm the operator feed updates without customer feed leakage.
6. Open the notification preferences UI and confirm only `In app` and `Email` channels are writable.

## Rollback Notes

This cutover is not designed for historical replay. Rolling back application code after the migration may leave clients expecting the old projector path while the cursor table is already removed.

If rollback is required:

1. stop new client rollout first
2. roll back API and client code together
3. treat notifications as degraded until schema/application compatibility is restored
