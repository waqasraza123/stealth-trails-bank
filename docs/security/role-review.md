# Role Review

## Roles currently expressed in the repo

- `operations_admin`
- `risk_manager`
- `senior_operator`
- `compliance_lead`

These roles are now resolved from bearer-authenticated operator identity and then normalized inside internal operator workflows.

## Current permission model

### Internal operator API access

Baseline requirement:
- valid bearer token tied to an active operator record
- active environment access for the target runtime

Risk:
- any operator token with excessive role assignment can reach more of the internal surface than intended
- fine-grained safety still depends on per-workflow role checks, not a single centralized RBAC layer

### Manual resolution

Allowed by default:
- `operations_admin`
- `risk_manager`
- `senior_operator`

Interpretation:
- manual resolution is high-risk because it can advance money-flow state without an automated chain proof

### Account hold apply

Allowed by default:
- `operations_admin`
- `risk_manager`

Interpretation:
- this is a restrictive control and should remain narrow

### Account hold release

Allowed by default:
- `operations_admin`
- `risk_manager`
- `compliance_lead`

Interpretation:
- release is governance-sensitive and should remain auditable

### Incident package release approval

Allowed by default:
- `compliance_lead`
- `risk_manager`

Interpretation:
- export release is a controlled disclosure path and should not depend on broad operator access

## Review findings

Strong points:
- several sensitive workflows already enforce role-aware checks
- role lists are centrally configurable through runtime config
- operator actions write audit and event history across core internal workflows

Weak points:
- there is still one coarse internal operator API key in front of all operator surfaces
- role transmission is request-header based and depends on upstream trust
- there is no in-repo identity provider or signed operator session model for internal operations

## Launch requirements

1. confirm approved role memberships outside the repo for every launch operator
2. verify no launch operator needs broader roles than their routine duty
3. verify incident package release approvers are not an unreviewed superset
4. verify shared-login bootstrap is disabled for launch
5. verify launch operators authenticate through bearer-backed operator identity, not legacy browser API-key headers
6. record the approved operator roster and their mapped roles in the launch checklist

## Recommended next hardening

- move from shared internal operator key trust toward per-operator authenticated internal identity
- require stronger separation between review, release, and emergency powers
- add explicit operator-role verification evidence to launch sign-off
