# Customer MFA API Runbook

## Runtime Controls

- `CUSTOMER_MFA_EMAIL_OTP_EXPIRY_SECONDS`
- `CUSTOMER_MFA_TOTP_ENROLLMENT_EXPIRY_SECONDS`
- `CUSTOMER_MFA_STEP_UP_FRESHNESS_SECONDS`
- `CUSTOMER_MFA_MAX_FAILED_ATTEMPTS`
- `CUSTOMER_MFA_LOCKOUT_SECONDS`
- `CUSTOMER_MFA_CHALLENGE_START_COOLDOWN_SECONDS`
- `CUSTOMER_MFA_RECOVERY_REQUEST_ALLOWED_OPERATOR_ROLES`
- `CUSTOMER_MFA_RECOVERY_APPROVER_ALLOWED_OPERATOR_ROLES`
- `CUSTOMER_MFA_EMAIL_DELIVERY_MODE`
- `CUSTOMER_MFA_EMAIL_DELIVERY_WEBHOOK_URL`
- `CUSTOMER_MFA_EMAIL_DELIVERY_BEARER_TOKEN`
- `CUSTOMER_MFA_EMAIL_DELIVERY_REQUEST_TIMEOUT_MS`
- `CUSTOMER_MFA_EMAIL_DELIVERY_FROM_EMAIL`
- `CUSTOMER_MFA_EMAIL_DELIVERY_FROM_NAME`

## Current Behavior

- Read-only customer access remains available when MFA is incomplete.
- Withdraw, send, and password rotation require a completed MFA posture.
- Sensitive verification paths now enforce:
  - failed-attempt counting
  - temporary lockout after too many bad codes
  - cooldown between challenge/code starts
  - automatic reset of failed-attempt state after successful verification
- Email OTP delivery now supports:
  - `preview` mode for local/non-production testing
  - `webhook` mode for real provider-backed delivery
  - audit events for delivery success and failure
  - platform alert creation when provider-backed delivery fails
- Customer authenticator recovery now supports:
  - self-service reset of the authenticator using the enrolled email backup factor
  - governed operator lockout release requests
  - governed operator full MFA reset requests
  - dual-control approval before operator recovery execution
  - automatic customer session invalidation when recovery is executed

## Support Handling

- If a customer is blocked by setup posture:
  - confirm TOTP enrollment is complete
  - confirm email backup enrollment is complete
- If a customer is blocked by lockout:
  - wait until `lockedUntil` passes
  - or use the governed `release_lockout` operator recovery path
  - do not manually modify DB state except through governed recovery execution
- If a customer lost the authenticator but still has the email backup factor:
  - use the customer self-service email recovery path in profile
  - after recovery completes, require immediate authenticator re-enrollment
- If a customer cannot complete self-service recovery:
  - create a governed customer MFA recovery request
  - use `release_lockout` to clear failed-attempt lockout only
  - use `reset_mfa` only after identity verification and support review
  - approvals must come from a different operator than the requester
  - execution must come from a different operator than the requester
- If local/dev testing needs email OTP:
  - set `CUSTOMER_MFA_EMAIL_DELIVERY_MODE=preview`
  - non-production responses may include `previewCode`
- For production-like environments:
  - set `CUSTOMER_MFA_EMAIL_DELIVERY_MODE=webhook`
  - configure `CUSTOMER_MFA_EMAIL_DELIVERY_WEBHOOK_URL`
  - optionally configure `CUSTOMER_MFA_EMAIL_DELIVERY_BEARER_TOKEN`
  - delivery failures will raise an open operations platform alert with code `customer_mfa_email_delivery_failed`

## Verification Paths

- `GET /auth/mfa/status`
- `POST /auth/mfa/totp/enrollment/start`
- `POST /auth/mfa/totp/enrollment/verify`
- `POST /auth/mfa/email/enrollment/start`
- `POST /auth/mfa/email/enrollment/verify`
- `POST /auth/mfa/challenge/start`
- `POST /auth/mfa/challenge/verify`
- `POST /auth/mfa/recovery/email/start`
- `POST /auth/mfa/recovery/email/verify`

## Internal Operator Endpoints

- `GET /auth/internal/customer-mfa-recovery-requests`
- `POST /auth/internal/customer-mfa-recovery/:supabaseUserId/request`
- `POST /auth/internal/customer-mfa-recovery-requests/:requestId/approve`
- `POST /auth/internal/customer-mfa-recovery-requests/:requestId/reject`
- `POST /auth/internal/customer-mfa-recovery-requests/:requestId/execute`
