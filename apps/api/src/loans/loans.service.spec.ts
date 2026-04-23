import { BadRequestException } from "@nestjs/common";
import { AccountLifecycleStatus, AssetType, Prisma, WalletCustodyType, WalletStatus } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoansService } from "./loans.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadOptionalBlockchainContractWriteRuntimeConfig: () => ({
    rpcUrl: "http://localhost:8545",
    ethereumPrivateKey: null,
    loanContractAddress: null
  })
}));

jest.mock("@stealth-trails-bank/contracts-sdk", () => ({
  createJsonRpcProvider: jest.fn(() => ({ provider: "mock" })),
  createLoanBookReadContract: jest.fn(),
  createLoanBookWriteContract: jest.fn()
}));

function createService() {
  const prismaService = {
    customerAssetBalance: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    asset: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    loanApplication: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    loanAgreement: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const authService = {
    getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
    getCustomerWalletProjectionBySupabaseUserId: jest.fn()
  } as unknown as AuthService;

  const ledgerService = {
    recordLoanDisbursement: jest.fn(),
    recordLoanRepayment: jest.fn()
  } as unknown as LedgerService;

  const governedExecutionService = {
    assertLoanFundingExecutionAllowed: jest.fn(),
    isLoanFundingGovernedExternalEnabled: jest.fn(() => false),
    requestLoanContractCreation: jest.fn()
  };
  const notificationsService = {
    publishLoanEventRecord: jest.fn().mockResolvedValue(undefined)
  };

  return {
    prismaService,
    authService,
    ledgerService,
    governedExecutionService,
    notificationsService,
    service: new LoansService(
      prismaService,
      authService,
      ledgerService,
      notificationsService as never,
      undefined,
      governedExecutionService as never
    )
  };
}

function mockEligibleCustomerContext(deps: {
  prismaService: PrismaService;
  authService: AuthService;
}) {
  (
    deps.authService.getCustomerAccountProjectionBySupabaseUserId as jest.Mock
  ).mockResolvedValue({
    customer: {
      id: "customer_1",
      email: "amina@example.com",
      supabaseUserId: "supabase_user_1"
    },
    customerAccount: {
      id: "account_1",
      status: AccountLifecycleStatus.active
    }
  });

  (
    deps.authService.getCustomerWalletProjectionBySupabaseUserId as jest.Mock
  ).mockResolvedValue({
    wallet: {
      id: "wallet_1",
      address: "0x1111222233334444555566667777888899990000",
      status: WalletStatus.active,
      custodyType: WalletCustodyType.platform_managed
    }
  });

  (deps.prismaService.customerAssetBalance.findMany as jest.Mock).mockResolvedValue([
    {
      asset: {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: AssetType.native,
        contractAddress: null
      },
      availableBalance: new Prisma.Decimal("5"),
      pendingBalance: new Prisma.Decimal("0")
    },
    {
      asset: {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: AssetType.erc20,
        contractAddress: "0x0000000000000000000000000000000000000abc"
      },
      availableBalance: new Prisma.Decimal("2000"),
      pendingBalance: new Prisma.Decimal("0")
    }
  ]);
}

describe("LoansService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a managed lending quote using the jurisdiction policy pack", async () => {
    const { service, prismaService, authService } = createService();
    mockEligibleCustomerContext({ prismaService, authService });

    (prismaService.asset.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin"
      })
      .mockResolvedValueOnce({
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether"
      });

    const quote = await service.previewQuote("supabase_user_1", {
      jurisdiction: "usa",
      borrowAssetSymbol: "USDC",
      collateralAssetSymbol: "ETH",
      borrowAmount: "1000",
      collateralAmount: "1600",
      termMonths: "5",
      autopayEnabled: true
    });

    expect(quote.jurisdiction).toBe("usa");
    expect(quote.serviceFeeAmount).toBe("27.5");
    expect(quote.totalRepayableAmount).toBe("1027.5");
    expect(quote.installmentCount).toBe(5);
    expect(quote.warningLtvBps).toBe(6800);
    expect(quote.liquidationLtvBps).toBe(8000);
    expect(quote.disclosureSummary).toMatch(/fixed service fee/i);
  });

  it("rejects application submission when the customer does not accept the disclosure", async () => {
    const { service, prismaService, authService } = createService();
    mockEligibleCustomerContext({ prismaService, authService });

    await expect(
      service.createApplication("supabase_user_1", {
        jurisdiction: "usa",
        borrowAssetSymbol: "USDC",
        collateralAssetSymbol: "ETH",
        borrowAmount: "1000",
        collateralAmount: "1600",
        termMonths: "6",
        autopayEnabled: true,
        disclosureAcknowledgement: "I understand the managed lending disclosure.",
        acceptServiceFeeDisclosure: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a managed lending application once eligibility and disclosure checks pass", async () => {
    const { service, prismaService, authService } = createService();
    mockEligibleCustomerContext({ prismaService, authService });

    (prismaService.asset.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin"
      })
      .mockResolvedValueOnce({
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether"
      });

    (prismaService.asset.findMany as jest.Mock).mockResolvedValue([
      {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: AssetType.native,
        contractAddress: null
      },
      {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: AssetType.erc20,
        contractAddress: "0x0000000000000000000000000000000000000abc"
      }
    ]);

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanApplication: {
          create: jest.fn().mockResolvedValue({
            id: "loan_application_1",
            status: "submitted"
          })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({
            id: "loan_event_1"
          })
        }
      })
    );

    const created = await service.createApplication("supabase_user_1", {
      jurisdiction: "usa",
      borrowAssetSymbol: "USDC",
      collateralAssetSymbol: "ETH",
      borrowAmount: "1000",
      collateralAmount: "1600",
      termMonths: "6",
      autopayEnabled: true,
      disclosureAcknowledgement: "I understand the managed lending disclosure.",
      acceptServiceFeeDisclosure: true,
      supportNote: "Customer requested a six month facility."
    });

    expect(created.applicationId).toBe("loan_application_1");
    expect(created.status).toBe("submitted");
    expect(created.quote.serviceFeeAmount).toBe("27.5");
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
  });

  it("records an immutable ledger journal when funding an agreement", async () => {
    const { service, prismaService, ledgerService } = createService();

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanAgreement: {
          findUnique: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "awaiting_funding",
            borrowAssetId: "asset_usdc",
            principalAmount: new Prisma.Decimal("1000"),
            serviceFeeAmount: new Prisma.Decimal("25"),
            borrowAsset: {
              chainId: 8453
            }
          }),
          update: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "active"
          })
        },
        loanCollateralPosition: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({
            id: "loan_event_1"
          })
        }
      })
    );

    (ledgerService.recordLoanDisbursement as jest.Mock).mockResolvedValue({
      ledgerJournalId: "ledger_journal_1",
      principalReceivableLedgerAccountId: "principal_receivable_1",
      serviceFeeReceivableLedgerAccountId: "fee_receivable_1",
      serviceFeeIncomeLedgerAccountId: "fee_income_1",
      creditLedgerAccountId: "outbound_clearing_1"
    });

    const result = await service.fundAgreement("loan_agreement_1", "worker_1");

    expect(ledgerService.recordLoanDisbursement).toHaveBeenCalledWith(
      expect.anything(),
      {
        loanAgreementId: "loan_agreement_1",
        assetId: "asset_usdc",
        chainId: 8453,
        principalAmount: new Prisma.Decimal("1000"),
        serviceFeeAmount: new Prisma.Decimal("25")
      }
    );
    expect(result).toEqual({
      loanAgreementId: "loan_agreement_1",
      status: "active"
    });
  });

  it("queues governed external loan contract execution instead of writing immediately", async () => {
    const {
      service,
      prismaService,
      authService,
      governedExecutionService
    } = createService();
    (governedExecutionService.isLoanFundingGovernedExternalEnabled as jest.Mock).mockReturnValue(
      true
    );

    (prismaService.loanApplication.findUnique as jest.Mock).mockResolvedValue({
      id: "loan_application_1",
      status: "submitted",
      customerAccountId: "account_1",
      customerAccount: {
        customer: {
          supabaseUserId: "supabase_user_1"
        }
      },
      requestedBorrowAmount: new Prisma.Decimal("1000"),
      requestedCollateralAmount: new Prisma.Decimal("1600"),
      serviceFeeAmount: new Prisma.Decimal("25"),
      requestedTermMonths: 6,
      autopayEnabled: true,
      jurisdiction: "usa",
      requestedBorrowAssetId: "asset_usdc",
      requestedBorrowAsset: {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: AssetType.erc20,
        contractAddress: "0xasset"
      },
      requestedCollateralAssetId: "asset_eth",
      requestedCollateralAsset: {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: AssetType.native,
        contractAddress: null
      },
      loanAgreement: null,
      events: []
    });

    (
      authService.getCustomerWalletProjectionBySupabaseUserId as jest.Mock
    ).mockResolvedValue({
      wallet: {
        address: "0xwallet"
      }
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanApplication: {
          update: jest.fn().mockResolvedValue({
            id: "loan_application_1",
            status: "approved",
            customerAccountId: "account_1",
            jurisdiction: "usa",
            requestedBorrowAssetId: "asset_usdc",
            requestedCollateralAssetId: "asset_eth",
            requestedBorrowAmount: new Prisma.Decimal("1000"),
            requestedCollateralAmount: new Prisma.Decimal("1600"),
            serviceFeeAmount: new Prisma.Decimal("25"),
            requestedTermMonths: 6,
            autopayEnabled: true,
            quoteSnapshot: {}
          })
        },
        loanAgreement: {
          create: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            borrowAssetId: "asset_usdc",
            principalAmount: new Prisma.Decimal("1000"),
            collateralAmount: new Prisma.Decimal("1600"),
            serviceFeeAmount: new Prisma.Decimal("25"),
            outstandingTotalAmount: new Prisma.Decimal("1025"),
            installmentAmount: new Prisma.Decimal("170.833333333333333333"),
            installmentCount: 6,
            termMonths: 6,
            autopayEnabled: true,
            contractLoanId: null
          })
        },
        loanInstallment: {
          createMany: jest.fn().mockResolvedValue({ count: 6 })
        },
        loanCollateralPosition: {
          create: jest.fn().mockResolvedValue({ id: "position_1" })
        },
        loanStatement: {
          create: jest.fn().mockResolvedValue({ id: "statement_1" })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({ id: "event_1" })
        }
      })
    );

    (governedExecutionService.requestLoanContractCreation as jest.Mock).mockResolvedValue({
      request: {
        id: "execution_1"
      },
      stateReused: false
    });

    const result = await service.approveApplication(
      "loan_application_1",
      "operator_1",
      "risk_manager",
      {
        note: "Approved subject to governed treasury execution."
      }
    );

    expect(governedExecutionService.requestLoanContractCreation).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        loanAgreementId: "loan_agreement_1",
        governedExecutionRequestId: "execution_1",
        fundingExecutionMode: "governed_external"
      })
    );
  });

  it("blocks funding until governed execution evidence is recorded", async () => {
    const { service, prismaService, governedExecutionService } = createService();
    (governedExecutionService.isLoanFundingGovernedExternalEnabled as jest.Mock).mockReturnValue(
      true
    );

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanAgreement: {
          findUnique: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "awaiting_funding",
            borrowAssetId: "asset_usdc",
            principalAmount: new Prisma.Decimal("1000"),
            serviceFeeAmount: new Prisma.Decimal("25"),
            contractLoanId: null,
            activationTransactionHash: null,
            borrowAsset: {
              chainId: 8453
            }
          })
        }
      })
    );

    await expect(service.fundAgreement("loan_agreement_1", "worker_1")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("records an immutable ledger journal when autopay settles a repayment", async () => {
    const { service, prismaService, ledgerService } = createService();

    (prismaService.loanAgreement.findUnique as jest.Mock).mockResolvedValue({
      id: "loan_agreement_1",
      customerAccountId: "account_1",
      borrowAssetId: "asset_usdc",
      jurisdiction: "usa",
      borrowAsset: {
        chainId: 8453
      },
      outstandingPrincipalAmount: new Prisma.Decimal("1000"),
      outstandingServiceFeeAmount: new Prisma.Decimal("25"),
      nextDueAt: new Date("2026-04-20T00:00:00.000Z"),
      installments: [
        {
          id: "installment_1",
          installmentNumber: 1,
          dueAt: new Date("2026-04-01T00:00:00.000Z"),
          status: "due",
          paidTotalAmount: new Prisma.Decimal("0"),
          scheduledTotalAmount: new Prisma.Decimal("205"),
          scheduledPrincipalAmount: new Prisma.Decimal("200"),
          scheduledServiceFeeAmount: new Prisma.Decimal("5")
        },
        {
          id: "installment_2",
          installmentNumber: 2,
          dueAt: new Date("2026-05-01T00:00:00.000Z")
        }
      ],
      repayments: [],
      collateralPositions: [],
      valuationSnapshots: [],
      liquidationCases: [],
      statements: [],
      events: [],
      autopayEnabled: true
    });

    (prismaService.customerAssetBalance.findUnique as jest.Mock).mockResolvedValue({
      availableBalance: new Prisma.Decimal("500")
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        loanRepaymentEvent: {
          create: jest.fn().mockResolvedValue({
            id: "repayment_1"
          })
        },
        loanInstallment: {
          update: jest.fn().mockResolvedValue({
            id: "installment_1",
            status: "paid"
          })
        },
        loanAgreement: {
          update: jest.fn().mockResolvedValue({
            id: "loan_agreement_1",
            status: "active"
          })
        },
        loanEvent: {
          create: jest.fn().mockResolvedValue({
            id: "loan_event_1"
          })
        }
      })
    );

    (ledgerService.recordLoanRepayment as jest.Mock).mockResolvedValue({
      ledgerJournalId: "ledger_journal_2",
      debitLedgerAccountId: "customer_liability_1",
      principalReceivableLedgerAccountId: "principal_receivable_1",
      serviceFeeReceivableLedgerAccountId: "fee_receivable_1",
      availableBalance: "295"
    });

    const result = await service.runAutopay("loan_agreement_1", "worker_1");

    expect(ledgerService.recordLoanRepayment).toHaveBeenCalledWith(
      expect.anything(),
      {
        loanAgreementId: "loan_agreement_1",
        loanRepaymentEventId: "repayment_1",
        customerAccountId: "account_1",
        assetId: "asset_usdc",
        chainId: 8453,
        principalAmount: new Prisma.Decimal("200"),
        serviceFeeAmount: new Prisma.Decimal("5"),
        totalAmount: new Prisma.Decimal("205")
      }
    );
    expect(result).toEqual({
      loanAgreementId: "loan_agreement_1",
      attempted: true,
      succeeded: true,
      repaymentId: "repayment_1",
      status: "active"
    });
  });
});
