# Customer authentication security

Customer access uses a mandatory password, verified primary email, and TOTP
authenticator check before a banking session is issued. Email OTP is used only
to verify ownership of the primary email address; it is not an authentication
factor and cannot reset MFA.

## Security controls

- Passwords are 15–128 Unicode characters, normalized with NFC, checked against
  common values and customer identity fields, and stored with Argon2id. Legacy
  bcrypt hashes are accepted once and upgraded after a successful password
  check.
- Login is a ten-minute server-side pre-authentication flow. No web cookie,
  access token, or refresh token exists until email verification, TOTP, password
  policy upgrade, and recovery-code setup are complete.
- Web uses an opaque `Secure`, `HttpOnly`, `SameSite=Strict` cookie plus a
  rotating in-memory CSRF token. Production web traffic is routed through
  `/api` so the cookie remains first-party. Browser storage never contains an
  authentication credential.
- Native mobile uses a ten-minute access JWT in memory and a rotating opaque
  refresh token in device-only SecureStore protected by device authentication.
  Refresh-token reuse revokes its entire token family.
- Every successful password change and “revoke all sessions” operation revokes
  every active credential and requires full MFA reauthentication.
- TOTP secrets are encrypted with AES-256-GCM and a versioned deployment key.
  Recovery codes are random, HMAC-peppered, one-time values. The existing
  dual-control operator recovery workflow remains the administrative fallback.
- Login and email-verification attempts use persistent, HMAC-keyed rate-limit
  buckets. Auth endpoints are non-cacheable and API/static responses add
  anti-sniffing, framing, referrer, permissions, HSTS, and CSP controls.

## Deployment order

1. Generate independent high-entropy `CUSTOMER_AUTH_HMAC_PEPPER` and
   base64-encoded 32-byte `CUSTOMER_AUTH_ENCRYPTION_KEY` values in the deployment
   secret manager. Set `CUSTOMER_AUTH_ENCRYPTION_KEY_VERSION` to the active key
   identifier. Never expose these values to web or Expo public environment
   variables.
2. Deploy the database migration
   `20260819120000_harden_customer_authentication` before the API build.
3. Deploy the API, then run
   `pnpm --filter @stealth-trails-bank/api backfill:customer-auth-secrets` once.
   The command encrypts legacy plaintext TOTP values and clears the plaintext
   columns without logging secrets.
4. Deploy web with its production API URL in `VITE_SERVER_URL`. The request
   interceptor and Vercel `/api` rewrite keep API traffic first-party. Configure
   `CORS_ALLOWED_ORIGINS` with exact web origins; do not use wildcards.
5. Deploy native mobile with an HTTPS `EXPO_PUBLIC_API_BASE_URL`. Non-local HTTP
   endpoints are rejected at startup, and Android cleartext traffic is disabled.

All pre-existing customers intentionally begin with an unverified email state
after migration. Their next correct password attempt sends a verification code,
and no account session is issued until verification and mandatory TOTP finish.

## Next steps

### Repository work

1. Implement forgotten-password recovery using verified email plus TOTP or a
   one-time recovery code, short-lived server-side state, strict throttling, and
   full session revocation after completion.
2. Remove the disabled legacy email-MFA enrollment, challenge, step-up, and
   recovery code paths from the API and both clients. Replace the obsolete
   skipped tests with explicit tests proving email OTP cannot authenticate a
   customer or reset MFA.
3. Add `Retry-After` response headers and complete throttling coverage for
   signup, email resend, verification, MFA enrollment, recovery, and password
   recovery endpoints.
4. Replace the small built-in common-password list with a maintained offline
   compromised-password dataset suitable for production use.
5. Add adversarial tests covering cookie flags, CSRF rejection, authentication
   flow expiry and replay, TOTP replay, recovery-code reuse, refresh-token reuse,
   lockouts, enumeration resistance, and concurrent refresh rotation.
6. Run the complete monorepo CI suite and repair any integration or end-to-end
   journeys that still assume persistent bearer tokens or email MFA.
7. Add scheduled cleanup for expired authentication flows, consumed recovery
   records where retention permits, and stale rate-limit buckets.
8. Add metrics and alerts for brute-force attempts, verification abuse, TOTP
   lockouts, recovery activity, refresh-token reuse, and unusual session
   creation.
9. Add staged encryption-key rotation tooling that can read the previous and
   current TOTP key versions while records are re-encrypted.
10. Improve enrollment UX with authenticator QR codes, explicit recovery-code
    save confirmation, print/download support, and refresh-safe pre-auth state.
11. Validate native iOS and Android release builds, entitlement/configuration
    output, biometric behavior, screen privacy, and HTTPS enforcement through
    the EAS/release pipeline.
12. Consider passkeys/WebAuthn as a phishing-resistant authentication factor.

### Deployment-dependent work

1. Generate and install independent production HMAC and TOTP encryption secrets
   in the deployment secret manager.
2. Apply the authentication migration to production and run the TOTP encryption
   backfill.
3. Configure exact production CORS origins and verify the first-party `/api`
   proxy and production cookie attributes on the deployed web application.
4. Validate the real email-delivery provider, production throttling behavior,
   security monitoring, native release builds, and incident-response alerts.
