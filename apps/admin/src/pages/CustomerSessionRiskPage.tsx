import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  listCustomerSessionRisks,
  revokeCustomerSessionRisk,
} from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  formatName,
  readApiErrorMessage,
  shortenValue,
  toTitleCase,
  trimToUndefined,
} from "@/lib/format";
import {
  ActionRail,
  AdminStatusBadge,
  DetailList,
  EmptyState,
  ErrorState,
  InlineNotice,
  ListCard,
  LoadingState,
  MetricCard,
  SectionPanel,
  WorkspaceLayout,
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

const platformOptions = [
  { value: "all", label: "All platforms" },
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "unknown", label: "Unknown" },
] as const;

function getChallengeStateLabel(
  challengeState: "not_started" | "pending" | "expired",
) {
  switch (challengeState) {
    case "pending":
      return "Challenge Pending";
    case "expired":
      return "Challenge Expired";
    default:
      return "Challenge Not Started";
  }
}

export function CustomerSessionRiskPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get("session");
  const [platformFilter, setPlatformFilter] =
    useState<(typeof platformOptions)[number]["value"]>("all");
  const [actionNote, setActionNote] = useState("");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sessionRisksQuery = useQuery({
    queryKey: ["customer-session-risks", session?.baseUrl, platformFilter],
    queryFn: () =>
      listCustomerSessionRisks(session!, {
        limit: 30,
        clientPlatform: platformFilter === "all" ? undefined : platformFilter,
      }),
    enabled: Boolean(session),
  });

  useEffect(() => {
    const firstSessionId = sessionRisksQuery.data?.sessions[0]?.id;

    if (firstSessionId && !selectedSessionId) {
      setSearchParams({ session: firstSessionId });
      return;
    }

    if (
      selectedSessionId &&
      sessionRisksQuery.data &&
      !sessionRisksQuery.data.sessions.some(
        (riskSession) => riskSession.id === selectedSessionId,
      )
    ) {
      if (firstSessionId) {
        setSearchParams({ session: firstSessionId });
      } else {
        setSearchParams({});
      }
    }
  }, [selectedSessionId, sessionRisksQuery.data, setSearchParams]);

  useEffect(() => {
    setActionError(null);
    setActionNote("");
    setGovernedConfirm(false);
  }, [selectedSessionId]);

  async function refreshQueue() {
    await queryClient.invalidateQueries({
      queryKey: ["customer-session-risks", session?.baseUrl],
    });
  }

  const selectedSession =
    sessionRisksQuery.data?.sessions.find(
      (riskSession) => riskSession.id === selectedSessionId,
    ) ?? null;

  const revokeMutation = useMutation({
    mutationFn: () =>
      revokeCustomerSessionRisk(session!, selectedSession!.id, {
        note: trimToUndefined(actionNote),
      }),
    onSuccess: async (result) => {
      setFlash(
        result.stateReused
          ? `Session already revoked (${shortenValue(result.session.id)}).`
          : `Risky session revoked (${shortenValue(result.session.id)}).`,
      );
      setActionError(null);
      setGovernedConfirm(false);
      await refreshQueue();
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to revoke the risky customer session."),
      );
    },
  });

  if (fallback) {
    return fallback;
  }

  if (sessionRisksQuery.isLoading) {
    return (
      <LoadingState
        title="Loading customer session risk queue"
        description="Active untrusted sessions and trust-challenge posture are loading."
      />
    );
  }

  if (sessionRisksQuery.isError) {
    return (
      <ErrorState
        title="Customer session risk queue unavailable"
        description="The operator session risk queue could not be loaded."
      />
    );
  }

  const countByChallengeState = (
    challengeState: "not_started" | "pending" | "expired",
  ) =>
    sessionRisksQuery.data?.summary.byChallengeState.find(
      (entry) => entry.challengeState === challengeState,
    )?.count ?? 0;

  const countByPlatform = (clientPlatform: "web" | "mobile" | "unknown") =>
    sessionRisksQuery.data?.summary.byPlatform.find(
      (entry) => entry.clientPlatform === clientPlatform,
    )?.count ?? 0;

  const canRevoke = Boolean(selectedSession) && !selectedSession!.revokedAt;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Customer Session Risk"
        description="Operator queue for active untrusted customer sessions, trust-challenge posture, and immediate containment."
      >
        <div className="admin-metric-grid">
          <MetricCard
            label="Active risky sessions"
            value={formatCount(sessionRisksQuery.data?.totalCount ?? 0)}
            detail="Current untrusted sessions that can still finish verification unless revoked."
          />
          <MetricCard
            label="Challenge pending"
            value={formatCount(countByChallengeState("pending"))}
            detail="Sessions with a still-valid trust code in flight."
          />
          <MetricCard
            label="Challenge expired"
            value={formatCount(countByChallengeState("expired"))}
            detail="Sessions that stalled after a trust code was sent."
          />
          <MetricCard
            label="Web sessions"
            value={formatCount(countByPlatform("web"))}
            detail="Web-based risky sessions in the active queue."
          />
        </div>

        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Active risk queue">
                <label className="admin-form-field">
                  <span>Platform filter</span>
                  <select
                    value={platformFilter}
                    onChange={(event) =>
                      setPlatformFilter(
                        event.target.value as (typeof platformOptions)[number]["value"],
                      )
                    }
                  >
                    {platformOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-list">
                  {sessionRisksQuery.data!.sessions.length > 0 ? (
                    sessionRisksQuery.data!.sessions.map((riskSession) => (
                      <button
                        key={riskSession.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedSessionId === riskSession.id ? "selected" : ""
                        }`}
                        onClick={() => setSearchParams({ session: riskSession.id })}
                      >
                        <strong>
                          {formatName(
                            riskSession.customer.firstName,
                            riskSession.customer.lastName,
                          )}
                        </strong>
                        <span>{riskSession.customer.email}</span>
                        <span>{getChallengeStateLabel(riskSession.challengeState)}</span>
                        <div className="admin-inline-cluster">
                          <AdminStatusBadge
                            label={toTitleCase(riskSession.clientPlatform)}
                            tone="technical"
                          />
                          <AdminStatusBadge
                            label={getChallengeStateLabel(riskSession.challengeState)}
                            tone={mapStatusToTone(riskSession.challengeState)}
                          />
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      title="No risky sessions"
                      description="There are no active untrusted customer sessions for the current filter."
                    />
                  )}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedSession ? (
              <>
                <ListCard title="Session detail">
                  <div className="admin-inline-cluster">
                    <AdminStatusBadge
                      label={toTitleCase(selectedSession.clientPlatform)}
                      tone="technical"
                    />
                    <AdminStatusBadge
                      label={getChallengeStateLabel(selectedSession.challengeState)}
                      tone={mapStatusToTone(selectedSession.challengeState)}
                    />
                    <AdminStatusBadge
                      label={
                        selectedSession.revokedAt ? "Revoked" : "Active untrusted"
                      }
                      tone={selectedSession.revokedAt ? "critical" : "warning"}
                    />
                  </div>
                  <DetailList
                    items={[
                      {
                        label: "Customer",
                        value: formatName(
                          selectedSession.customer.firstName,
                          selectedSession.customer.lastName,
                        ),
                      },
                      {
                        label: "Email",
                        value: selectedSession.customer.email,
                      },
                      {
                        label: "Supabase user ID",
                        value: selectedSession.customer.supabaseUserId,
                        mono: true,
                      },
                      {
                        label: "Customer account",
                        value: shortenValue(selectedSession.customer.customerAccountId),
                        mono: true,
                      },
                      {
                        label: "Account status",
                        value: toTitleCase(
                          selectedSession.customer.accountStatus ?? "not_available",
                        ),
                      },
                      {
                        label: "Session ID",
                        value: selectedSession.id,
                        mono: true,
                      },
                      {
                        label: "IP address",
                        value: selectedSession.ipAddress ?? "Not available",
                        mono: true,
                      },
                      {
                        label: "User agent",
                        value: selectedSession.userAgent ?? "Not available",
                      },
                      {
                        label: "Challenge sent",
                        value: selectedSession.trustChallengeSentAt
                          ? formatDateTime(selectedSession.trustChallengeSentAt)
                          : "Not started",
                      },
                      {
                        label: "Challenge expires",
                        value: selectedSession.trustChallengeExpiresAt
                          ? formatDateTime(selectedSession.trustChallengeExpiresAt)
                          : "Not available",
                      },
                      {
                        label: "Created",
                        value: formatDateTime(selectedSession.createdAt),
                      },
                      {
                        label: "Last seen",
                        value: formatDateTime(selectedSession.lastSeenAt),
                      },
                    ]}
                  />
                </ListCard>

                <ListCard title="Operator guidance">
                  <InlineNotice
                    title="Contain unfamiliar sessions quickly"
                    description="Revoke sessions that show high-risk signals, stale trust challenges, or customer-reported unfamiliar access. Customers can still self-verify if the session remains active."
                    tone="warning"
                  />
                </ListCard>
              </>
            ) : (
              <EmptyState
                title="No session selected"
                description="Choose a risky session from the queue to inspect customer and device context."
              />
            )
          }
          rail={
            <ActionRail
              title="Containment"
              description="Revoke the selected untrusted session to force a fresh sign-in."
            >
              {flash ? (
                <InlineNotice
                  title="Queue updated"
                  description={flash}
                  tone="positive"
                />
              ) : null}
              {actionError ? (
                <InlineNotice
                  title="Action failed"
                  description={actionError}
                  tone="critical"
                />
              ) : null}
              <label className="admin-form-field">
                <span>Revocation note</span>
                <textarea
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  placeholder="Document customer report, analyst observation, or unusual device evidence."
                  rows={4}
                />
              </label>
              <label className="admin-inline-checkbox">
                <input
                  type="checkbox"
                  checked={governedConfirm}
                  onChange={(event) => setGovernedConfirm(event.target.checked)}
                />
                <span>I reviewed the session context and want to revoke this risky session.</span>
              </label>
              <button
                type="button"
                className="admin-primary-button"
                disabled={!canRevoke || !governedConfirm || revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
              >
                Revoke risky session
              </button>
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
