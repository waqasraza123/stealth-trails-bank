import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveLoanApplication,
  approveLoanLiquidation,
  closeLoanAgreement,
  executeLoanLiquidation,
  getLoanAgreementWorkspace,
  getLoanApplicationWorkspace,
  getLoanOperationsSummary,
  listLoanAgreements,
  listLoanApplications,
  placeLoanAccountRestriction,
  rejectLoanApplication,
  requestLoanEvidence,
  startLoanLiquidationReview
} from "@/lib/api";
import { formatDateTime, formatName, readApiErrorMessage, toTitleCase, trimToUndefined } from "@/lib/format";
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
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

export function LoansPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [actionNote, setActionNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const selectedApplicationId = searchParams.get("loanApplication");
  const selectedAgreementId = searchParams.get("loanAgreement");

  const summaryQuery = useQuery({
    queryKey: ["loan-summary", session?.baseUrl],
    queryFn: () => getLoanOperationsSummary(session!),
    enabled: Boolean(session)
  });

  const applicationsQuery = useQuery({
    queryKey: ["loan-applications", session?.baseUrl],
    queryFn: () => listLoanApplications(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const agreementsQuery = useQuery({
    queryKey: ["loan-agreements", session?.baseUrl],
    queryFn: () => listLoanAgreements(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const applicationWorkspaceQuery = useQuery({
    queryKey: ["loan-application-workspace", session?.baseUrl, selectedApplicationId],
    queryFn: () => getLoanApplicationWorkspace(session!, selectedApplicationId!),
    enabled: Boolean(session && selectedApplicationId)
  });

  const agreementWorkspaceQuery = useQuery({
    queryKey: ["loan-agreement-workspace", session?.baseUrl, selectedAgreementId],
    queryFn: () => getLoanAgreementWorkspace(session!, selectedAgreementId!),
    enabled: Boolean(session && selectedAgreementId)
  });

  useEffect(() => {
    if (!selectedApplicationId && applicationsQuery.data?.applications[0]?.id) {
      setSearchParams({
        loanApplication: applicationsQuery.data.applications[0].id
      });
    }
  }, [applicationsQuery.data, selectedApplicationId, setSearchParams]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["loan-summary", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["loan-applications", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["loan-agreements", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["loan-application-workspace", session?.baseUrl, selectedApplicationId]
      }),
      queryClient.invalidateQueries({
        queryKey: ["loan-agreement-workspace", session?.baseUrl, selectedAgreementId]
      })
    ]);
  }

  function createActionMutation<TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<unknown>,
    successMessage: string
  ) {
    return useMutation({
      mutationFn: (...args: TArgs) => action(...args),
      onSuccess: async () => {
        setActionError(null);
        setFlash(successMessage);
        await refreshWorkspace();
      },
      onError: (error) => {
        setActionError(readApiErrorMessage(error, "Governed loan action failed."));
      }
    });
  }

  const requestEvidenceMutation = createActionMutation(
    () => requestLoanEvidence(session!, selectedApplicationId!, trimToUndefined(actionNote)),
    "Evidence request recorded."
  );
  const approveApplicationMutation = createActionMutation(
    () => approveLoanApplication(session!, selectedApplicationId!, trimToUndefined(actionNote)),
    "Loan application approved."
  );
  const rejectApplicationMutation = createActionMutation(
    () => rejectLoanApplication(session!, selectedApplicationId!, trimToUndefined(actionNote)),
    "Loan application rejected."
  );
  const placeRestrictionMutation = createActionMutation(
    () =>
      placeLoanAccountRestriction(
        session!,
        selectedApplicationId!,
        trimToUndefined(actionNote),
        "loan_risk_restriction"
      ),
    "Customer account restricted."
  );
  const startLiquidationMutation = createActionMutation(
    () => startLoanLiquidationReview(session!, selectedAgreementId!, trimToUndefined(actionNote)),
    "Liquidation review started."
  );
  const approveLiquidationMutation = createActionMutation(
    () => approveLoanLiquidation(session!, selectedAgreementId!, trimToUndefined(actionNote)),
    "Liquidation approved."
  );
  const executeLiquidationMutation = createActionMutation(
    () => executeLoanLiquidation(session!, selectedAgreementId!, trimToUndefined(actionNote)),
    "Liquidation executed."
  );
  const closeAgreementMutation = createActionMutation(
    () => closeLoanAgreement(session!, selectedAgreementId!, trimToUndefined(actionNote)),
    "Loan agreement closed."
  );

  if (fallback) {
    return fallback;
  }

  if (summaryQuery.isLoading || applicationsQuery.isLoading || agreementsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading lending workspace"
        description="Application queues, agreement states, and governed lending controls are loading."
      />
    );
  }

  if (summaryQuery.isError || applicationsQuery.isError || agreementsQuery.isError) {
    return (
      <ErrorState
        title="Lending workspace unavailable"
        description="The lending command surface could not be loaded. Recheck the operator session and retry."
      />
    );
  }

  const selectedApplication =
    applicationWorkspaceQuery.data?.application ??
    applicationsQuery.data!.applications.find((item) => item.id === selectedApplicationId) ??
    null;
  const selectedAgreement =
    agreementWorkspaceQuery.data?.agreement ??
    agreementsQuery.data!.agreements.find((item) => item.id === selectedAgreementId) ??
    null;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Lending operations"
        description="Origination, servicing, collateral health, and governed liquidation actions."
      >
        <div className="admin-metrics-grid">
          <MetricCard
            label="Applications"
            value={String(
              summaryQuery.data!.applicationBacklog.reduce((sum, item) => sum + item.count, 0)
            )}
            detail="Applications currently in workflow."
          />
          <MetricCard
            label="Active loans"
            value={String(
              summaryQuery.data!.agreementStates.find((item) => item.status === "active")?.count ?? 0
            )}
            detail="Loans already funded and in servicing."
          />
          <MetricCard
            label="Liquidations"
            value={String(
              summaryQuery.data!.liquidationStates.reduce((sum, item) => sum + item.count, 0)
            )}
            detail="Governed liquidation cases across all states."
          />
        </div>

        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Applications queue">
                <div className="admin-list">
                  {applicationsQuery.data!.applications.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedApplicationId === application.id ? "selected" : ""
                      }`}
                      onClick={() =>
                        setSearchParams({
                          loanApplication: application.id,
                          ...(application.linkedLoanAgreementId
                            ? { loanAgreement: application.linkedLoanAgreementId }
                            : {})
                        })
                      }
                    >
                      <strong>
                        {formatName(
                          application.customer.firstName,
                          application.customer.lastName
                        )}
                      </strong>
                      <span>{application.borrowAsset.symbol} {application.requestedBorrowAmount}</span>
                      <span>{application.collateralAsset.symbol} {application.requestedCollateralAmount}</span>
                      <AdminStatusBadge
                        label={toTitleCase(application.status)}
                        tone={mapStatusToTone(application.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Agreements">
                <div className="admin-list">
                  {agreementsQuery.data!.agreements.map((agreement) => (
                    <button
                      key={agreement.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedAgreementId === agreement.id ? "selected" : ""
                      }`}
                      onClick={() =>
                        setSearchParams({
                          ...(selectedApplicationId ? { loanApplication: selectedApplicationId } : {}),
                          loanAgreement: agreement.id
                        })
                      }
                    >
                      <strong>{agreement.customer.email}</strong>
                      <span>{agreement.borrowAsset} / {agreement.collateralAsset}</span>
                      <span>{agreement.outstandingTotalAmount}</span>
                      <AdminStatusBadge
                        label={toTitleCase(agreement.status)}
                        tone={mapStatusToTone(agreement.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>
            </>
          }
          main={
            <>
              <ListCard title="Application workspace">
                {selectedApplication ? (
                  <>
                    <DetailList
                      items={[
                        { label: "Application", value: selectedApplication.id, mono: true },
                        {
                          label: "Customer",
                          value: formatName(
                            selectedApplication.customer.firstName,
                            selectedApplication.customer.lastName
                          )
                        },
                        {
                          label: "Borrow request",
                          value: `${selectedApplication.requestedBorrowAmount} ${selectedApplication.borrowAsset.symbol}`
                        },
                        {
                          label: "Collateral",
                          value: `${selectedApplication.requestedCollateralAmount} ${selectedApplication.collateralAsset.symbol}`
                        },
                        {
                          label: "Status",
                          value: (
                            <AdminStatusBadge
                              label={toTitleCase(selectedApplication.status)}
                              tone={mapStatusToTone(selectedApplication.status)}
                            />
                          )
                        }
                      ]}
                    />
                    <TimelinePanel
                      title="Application timeline"
                      description="Every governed decision and evidence request is attached to the application timeline."
                      events={applicationWorkspaceQuery.data?.timeline ?? []}
                      emptyState={{
                        title: "No application events",
                        description: "Application state changes will appear here."
                      }}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No application selected"
                    description="Choose a lending application to inspect its quote, customer context, and governed decisions."
                  />
                )}
              </ListCard>

              <ListCard title="Agreement workspace">
                {selectedAgreement ? (
                  <>
                    <DetailList
                      items={[
                        { label: "Agreement", value: selectedAgreement.id, mono: true },
                        {
                          label: "Outstanding",
                          value: `${selectedAgreement.outstandingTotalAmount} ${selectedAgreement.borrowAsset.symbol}`
                        },
                        {
                          label: "Next due",
                          value: selectedAgreement.nextDueAt
                            ? formatDateTime(selectedAgreement.nextDueAt)
                            : "Not scheduled"
                        },
                        {
                          label: "Autopay",
                          value: selectedAgreement.autopayEnabled ? "Enabled" : "Disabled"
                        }
                      ]}
                    />
                    <TimelinePanel
                      title="Agreement timeline"
                      description="Servicing, valuation refreshes, autopay outcomes, and liquidation actions use the same timeline grammar."
                      events={agreementWorkspaceQuery.data?.timeline ?? []}
                      emptyState={{
                        title: "No servicing events",
                        description: "Funding, autopay, and liquidation events will appear here."
                      }}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No agreement selected"
                    description="Choose a funded or governed loan agreement to inspect collateral, repayments, and distress handling."
                  />
                )}
              </ListCard>
            </>
          }
          rail={
            <ActionRail
              title="Governed lending actions"
              description="Each action should include rationale. High-risk steps intentionally remain slow and visible."
            >
              {flash ? (
                <InlineNotice title="Action recorded" description={flash} tone="positive" />
              ) : null}
              {actionError ? (
                <InlineNotice title="Action failed" description={actionError} tone="critical" />
              ) : null}
              <textarea
                className="admin-textarea"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="Operator note or governance rationale"
              />
              <div className="admin-action-group">
                <button
                  type="button"
                  className="admin-button"
                  disabled={!selectedApplicationId || requestEvidenceMutation.isPending}
                  onClick={() => void requestEvidenceMutation.mutate()}
                >
                  Request evidence
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--positive"
                  disabled={!selectedApplicationId || approveApplicationMutation.isPending}
                  onClick={() => void approveApplicationMutation.mutate()}
                >
                  Approve application
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={!selectedApplicationId || rejectApplicationMutation.isPending}
                  onClick={() => void rejectApplicationMutation.mutate()}
                >
                  Reject application
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={!selectedApplicationId || placeRestrictionMutation.isPending}
                  onClick={() => void placeRestrictionMutation.mutate()}
                >
                  Restrict account
                </button>
              </div>
              <div className="admin-action-group">
                <button
                  type="button"
                  className="admin-button"
                  disabled={!selectedAgreementId || startLiquidationMutation.isPending}
                  onClick={() => void startLiquidationMutation.mutate()}
                >
                  Start liquidation review
                </button>
                <button
                  type="button"
                  className="admin-button"
                  disabled={!selectedAgreementId || approveLiquidationMutation.isPending}
                  onClick={() => void approveLiquidationMutation.mutate()}
                >
                  Approve liquidation
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={!selectedAgreementId || executeLiquidationMutation.isPending}
                  onClick={() => void executeLiquidationMutation.mutate()}
                >
                  Execute liquidation
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--positive"
                  disabled={!selectedAgreementId || closeAgreementMutation.isPending}
                  onClick={() => void closeAgreementMutation.mutate()}
                >
                  Close agreement
                </button>
              </div>
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
