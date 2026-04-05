import type {
  AccountLifecycleStatusValue,
  UserProfileProjection
} from "@stealth-trails-bank/types";

const accountStatusLabels: Record<AccountLifecycleStatusValue, string> = {
  registered: "Registered",
  email_verified: "Email Verified",
  review_required: "Review Required",
  active: "Active",
  restricted: "Restricted",
  frozen: "Frozen",
  closed: "Closed"
};

export function formatAccountStatusLabel(
  status: AccountLifecycleStatusValue | null | undefined
): string {
  if (!status) {
    return "Not Provisioned";
  }

  return accountStatusLabels[status];
}

export function getAccountStatusBadgeTone(
  status: AccountLifecycleStatusValue | null | undefined
): string {
  if (!status) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (status === "active" || status === "email_verified") {
    return "border-mint-200 bg-mint-100 text-mint-700";
  }

  if (status === "registered" || status === "review_required") {
    return "border-orange-200 bg-orange-100 text-orange-700";
  }

  if (status === "restricted" || status === "frozen" || status === "closed") {
    return "border-red-200 bg-red-100 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function getAccountStatusSummary(
  status: AccountLifecycleStatusValue | null | undefined
): string {
  if (!status) {
    return "Customer account lifecycle data has not been provisioned yet.";
  }

  switch (status) {
    case "active":
      return "This managed account is active and can use the currently released customer flows.";
    case "email_verified":
      return "Identity exists, but the managed account lifecycle has not reached full active status yet.";
    case "review_required":
      return "Customer activity is gated behind additional internal review before broader product access is released.";
    case "restricted":
      return "The account is under restriction and some product actions may be withheld by policy.";
    case "frozen":
      return "The account is frozen and customer-side financial actions should be treated as unavailable.";
    case "closed":
      return "The account is closed and should not present active product controls.";
    case "registered":
    default:
      return "The account has been registered but is still moving through the managed-account lifecycle.";
  }
}

export function getAccountLifecycleEntries(
  profile: Pick<
    UserProfileProjection,
    "activatedAt" | "restrictedAt" | "frozenAt" | "closedAt"
  >
) {
  return [
    {
      label: "Activated",
      value: profile.activatedAt
    },
    {
      label: "Restricted",
      value: profile.restrictedAt
    },
    {
      label: "Frozen",
      value: profile.frozenAt
    },
    {
      label: "Closed",
      value: profile.closedAt
    }
  ].filter((entry) => Boolean(entry.value));
}
