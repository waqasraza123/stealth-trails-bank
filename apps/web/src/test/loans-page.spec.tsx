import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Loans from "@/pages/Loans";
import {
  useCreateLoanApplication,
  useLoansDashboard,
  usePreviewLoanQuote,
  useSetLoanAutopay
} from "@/hooks/loans/useLoans";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseLoansDashboard = vi.mocked(useLoansDashboard);
const mockUsePreviewLoanQuote = vi.mocked(usePreviewLoanQuote);
const mockUseCreateLoanApplication = vi.mocked(useCreateLoanApplication);
const mockUseSetLoanAutopay = vi.mocked(useSetLoanAutopay);

vi.mock("@/hooks/loans/useLoans", () => ({
  useLoansDashboard: vi.fn(),
  usePreviewLoanQuote: vi.fn(),
  useCreateLoanApplication: vi.fn(),
  useSetLoanAutopay: vi.fn()
}));

describe("loans page", () => {
  beforeEach(() => {
    mockUsePreviewLoanQuote.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      mutateAsync: vi.fn()
    } as never);

    mockUseCreateLoanApplication.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn()
    } as never);

    mockUseSetLoanAutopay.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn()
    } as never);

    mockUseLoansDashboard.mockReturnValue({
      data: {
        account: {
          customerId: "customer_1",
          customerAccountId: "account_1",
          email: "amina@example.com",
          walletAddress: "0x1111222233334444555566667777888899990000",
          accountStatus: "active",
          walletStatus: "active",
          custodyType: "platform_managed"
        },
        eligibility: {
          eligible: true,
          accountReady: true,
          custodyReady: true,
          anyCollateralReady: true,
          reasons: [],
          borrowingCapacity: {
            ETH: "1.5",
            USDC: "7500"
          }
        },
        policyPacks: [
          {
            jurisdiction: "usa",
            displayName: "United States",
            disclosureTitle: "US lending disclosure",
            disclosureBody: "Interest-free lending with a fixed service fee.",
            serviceFeeRateBps: 275,
            warningLtvBps: 6800,
            liquidationLtvBps: 8000,
            gracePeriodDays: 10
          }
        ],
        supportedBorrowAssets: ["ETH", "USDC"],
        supportedCollateralAssets: ["ETH", "USDC"],
        balances: [],
        applications: [
          {
            id: "loan_application_1",
            status: "submitted",
            jurisdiction: "usa",
            requestedBorrowAmount: "1000",
            requestedCollateralAmount: "1600",
            requestedTermMonths: 6,
            serviceFeeAmount: "27.5",
            borrowAsset: {
              symbol: "USDC",
              displayName: "USD Coin"
            },
            collateralAsset: {
              symbol: "ETH",
              displayName: "Ethereum"
            },
            submittedAt: "2026-04-10T00:00:00.000Z",
            reviewedAt: null,
            note: null,
            linkedLoanAgreementId: "loan_agreement_1",
            timeline: [
              {
                id: "loan_event_1",
                label: "Submitted",
                tone: "technical",
                timestamp: "2026-04-10T00:00:00.000Z",
                description: "Customer submitted a managed lending application."
              }
            ]
          }
        ],
        agreements: [
          {
            id: "loan_agreement_1",
            status: "active",
            jurisdiction: "usa",
            principalAmount: "1000",
            collateralAmount: "1600",
            serviceFeeAmount: "27.5",
            outstandingPrincipalAmount: "1000",
            outstandingServiceFeeAmount: "27.5",
            outstandingTotalAmount: "1027.5",
            installmentAmount: "171.25",
            installmentCount: 6,
            termMonths: 6,
            autopayEnabled: true,
            borrowAsset: {
              symbol: "USDC",
              displayName: "USD Coin"
            },
            collateralAsset: {
              symbol: "ETH",
              displayName: "Ethereum"
            },
            nextDueAt: "2026-05-10T00:00:00.000Z",
            fundedAt: "2026-04-11T00:00:00.000Z",
            activatedAt: "2026-04-11T00:00:00.000Z",
            gracePeriodEndsAt: null,
            statementReferences: [],
            collateralPositions: [],
            installments: [
              {
                id: "installment_1",
                installmentNumber: 1,
                dueAt: "2026-05-10T00:00:00.000Z",
                status: "due",
                scheduledPrincipalAmount: "166.66",
                scheduledServiceFeeAmount: "4.58",
                scheduledTotalAmount: "171.25",
                paidTotalAmount: "0"
              }
            ],
            liquidationCases: [],
            timeline: [
              {
                id: "loan_event_2",
                label: "Funded",
                tone: "positive",
                timestamp: "2026-04-11T00:00:00.000Z",
                description: "Funding workflow completed and the agreement is active."
              }
            ],
            notice: "Your loan is active and being serviced on its disclosed installment schedule."
          }
        ]
      },
      error: null,
      isLoading: false
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the real lending workspace instead of the old placeholder", () => {
    renderWithRouter(<Loans />);

    expect(screen.getByText(/^Managed lending$/i)).toBeInTheDocument();
    expect(screen.getByText(/account is eligible for managed lending/i)).toBeInTheDocument();
    expect(screen.getByText(/new loan application/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Selected agreement$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Application tracker$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/USDC/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/loans & savings/i)).not.toBeInTheDocument();
  });
});
