import type { AccountLifecycleStatusValue } from "@stealth-trails-bank/types";

export function formatAccountStatusLabel(
  status: AccountLifecycleStatusValue | null | undefined,
  locale: "en" | "ar"
) {
  if (!status) {
    return locale === "ar" ? "غير مهيأ" : "Not provisioned";
  }

  const labels = {
    en: {
      registered: "Registered",
      email_verified: "Email verified",
      review_required: "Review required",
      active: "Active",
      restricted: "Restricted",
      frozen: "Frozen",
      closed: "Closed"
    },
    ar: {
      registered: "مسجل",
      email_verified: "تم التحقق من البريد",
      review_required: "تتطلب مراجعة",
      active: "نشط",
      restricted: "مقيد",
      frozen: "مجمّد",
      closed: "مغلق"
    }
  };

  return labels[locale][status];
}

export function getAccountStatusTone(
  status: AccountLifecycleStatusValue | null | undefined
): "neutral" | "positive" | "warning" | "critical" {
  if (!status) {
    return "neutral";
  }

  if (status === "active" || status === "email_verified") {
    return "positive";
  }

  if (status === "registered" || status === "review_required") {
    return "warning";
  }

  return "critical";
}
