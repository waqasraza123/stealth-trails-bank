import { fireEvent, waitFor } from "@testing-library/react-native";
import { LoansScreen } from "./LoansScreen";
import { renderMobile } from "../test/test-utils";

jest.mock("../hooks/use-customer-queries", () => ({
  useLoansDashboardQuery: jest.fn(),
  useQuotePreviewMutation: jest.fn(),
  useCreateLoanApplicationMutation: jest.fn(),
  useAutopayMutation: jest.fn()
}));

jest.mock("../components/ui/ScreenHeaderActions", () => ({
  ScreenHeaderActions: () => null
}));

const {
  useLoansDashboardQuery,
  useQuotePreviewMutation,
  useCreateLoanApplicationMutation,
  useAutopayMutation
} = jest.requireMock("../hooks/use-customer-queries") as {
  useLoansDashboardQuery: jest.Mock;
  useQuotePreviewMutation: jest.Mock;
  useCreateLoanApplicationMutation: jest.Mock;
  useAutopayMutation: jest.Mock;
};

describe("LoansScreen", () => {
  const previewMutateAsync = jest.fn();
  const applicationMutateAsync = jest.fn();

  beforeEach(() => {
    previewMutateAsync.mockReset();
    applicationMutateAsync.mockReset();
    useLoansDashboardQuery.mockReturnValue({
      data: {
        eligibility: {
          eligible: true,
          reasons: [],
          borrowingCapacity: {
            ETH: "3",
            USDC: "1500"
          }
        },
        policyPacks: [
          {
            jurisdiction: "usa",
            displayName: "United States",
            disclosureTitle: "Disclosure",
            disclosureBody: "Body",
            serviceFeeRateBps: 500,
            warningLtvBps: 7000,
            liquidationLtvBps: 8000,
            gracePeriodDays: 5
          }
        ],
        supportedBorrowAssets: ["ETH", "USDC"],
        supportedCollateralAssets: ["ETH", "USDC"],
        applications: [],
        agreements: []
      },
      isError: false
    });
    useQuotePreviewMutation.mockReturnValue({
      mutateAsync: previewMutateAsync,
      isPending: false,
      data: null
    });
    useCreateLoanApplicationMutation.mockReturnValue({
      mutateAsync: applicationMutateAsync,
      isPending: false
    });
    useAutopayMutation.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false
    });
  });

  it("submits a quote preview with the default valid form", async () => {
    previewMutateAsync.mockResolvedValueOnce({
      principalAmount: "1000",
      serviceFeeAmount: "50",
      installmentAmount: "175",
      borrowAssetSymbol: "USDC"
    });

    const screen = renderMobile(<LoansScreen />);

    fireEvent.press(screen.getByText("Quote preview"));

    await waitFor(() => {
      expect(previewMutateAsync).toHaveBeenCalledWith({
        autopayEnabled: true,
        borrowAmount: "1000",
        borrowAssetSymbol: "USDC",
        collateralAmount: "1600",
        collateralAssetSymbol: "ETH",
        jurisdiction: "usa",
        termMonths: "6"
      });
    });
  });

  it("submits the application only after disclosure acknowledgement", async () => {
    applicationMutateAsync.mockResolvedValueOnce({
      id: "loan-app-1"
    });

    const screen = renderMobile(<LoansScreen />);

    fireEvent.press(screen.getByText("Submit application"));

    expect(applicationMutateAsync).not.toHaveBeenCalled();

    fireEvent(screen.getByLabelText(
      "I acknowledge that the disclosed service fee is fixed and non-interest bearing."
    ), "valueChange", true);
    fireEvent.press(screen.getByText("Submit application"));

    await waitFor(() => {
      expect(applicationMutateAsync).toHaveBeenCalledWith({
        autopayEnabled: true,
        borrowAmount: "1000",
        borrowAssetSymbol: "USDC",
        collateralAmount: "1600",
        collateralAssetSymbol: "ETH",
        jurisdiction: "usa",
        termMonths: "6",
        disclosureAcknowledgement:
          "I acknowledge that the disclosed service fee is fixed and non-interest bearing.",
        acceptServiceFeeDisclosure: true,
        supportNote: undefined
      });
    });
  });
});
