import {
  Optional,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { loadOptionalBlockchainContractWriteRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  createJsonRpcProvider,
  createLoanBookReadContract,
  createLoanBookWriteContract
} from "@stealth-trails-bank/contracts-sdk";
import type {
  JurisdictionLoanPolicyPack,
  LoanQuote
} from "@stealth-trails-bank/types";
import {
  AccountLifecycleStatus,
  AssetType,
  LoanCollateralStatus,
  LoanInstallmentStatus,
  LoanLiquidationStatus,
  LoanLifecycleStatus,
  LoanRepaymentStatus,
  Prisma,
  WalletCustodyType,
  WalletStatus
} from "@prisma/client";
import { ethers } from "ethers";
import { randomUUID } from "node:crypto";
import {
  AuthService,
  type CustomerAccountProjection,
  type CustomerWalletProjection
} from "../auth/auth.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { SolvencyService } from "../solvency/solvency.service";
import { CreateLoanApplicationDto } from "./dto/create-loan-application.dto";
import { ListOperatorLoanAgreementsDto } from "./dto/list-operator-loan-agreements.dto";
import { ListOperatorLoanApplicationsDto } from "./dto/list-operator-loan-applications.dto";
import { OperatorLoanActionDto } from "./dto/operator-loan-action.dto";
import { PreviewLoanQuoteDto } from "./dto/preview-loan-quote.dto";

type CustomerLoansContext = {
  customer: CustomerAccountProjection["customer"];
  customerAccount: CustomerAccountProjection["customerAccount"];
  wallet: CustomerWalletProjection["wallet"];
  balances: Array<{
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
      assetType: AssetType;
      contractAddress: string | null;
    };
    availableBalance: Prisma.Decimal;
    pendingBalance: Prisma.Decimal;
  }>;
};

type LoanAssetRecord = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  assetType: AssetType;
  contractAddress: string | null;
};

type SerializedTimelineEvent = {
  id: string;
  label: string;
  tone: "neutral" | "positive" | "warning" | "critical" | "technical";
  timestamp: string;
  description: string;
  metadata?: Array<{ label: string; value: string }>;
};

const SUPPORTED_BORROW_ASSETS = ["ETH", "USDC"] as const;
const SUPPORTED_COLLATERAL_ASSETS = ["ETH", "USDC"] as const;

const JURISDICTION_POLICY_PACKS: Record<string, JurisdictionLoanPolicyPack> = {
  saudi_arabia: {
    jurisdiction: "saudi_arabia",
    displayName: "Saudi Arabia",
    currency: "USD",
    supportedBorrowSymbols: [...SUPPORTED_BORROW_ASSETS],
    supportedCollateralSymbols: [...SUPPORTED_COLLATERAL_ASSETS],
    disclosureTitle: "Saudi lending disclosure",
    disclosureBody:
      "Shariah-sensitive, interest-free lending with a fixed disclosed service fee and manual governance on distressed outcomes.",
    serviceFeeRateBps: 220,
    minPrincipalUsd: "500",
    maxPrincipalUsd: "100000",
    minimumTermMonths: 1,
    maximumTermMonths: 12,
    initialLtvBps: 6667,
    warningLtvBps: 7000,
    liquidationLtvBps: 8200,
    gracePeriodDays: 7,
    requiredApproverRoles: ["risk_manager", "compliance_lead"],
    liquidationApproverRoles: ["risk_manager", "compliance_lead"]
  },
  uae: {
    jurisdiction: "uae",
    displayName: "United Arab Emirates",
    currency: "USD",
    supportedBorrowSymbols: [...SUPPORTED_BORROW_ASSETS],
    supportedCollateralSymbols: [...SUPPORTED_COLLATERAL_ASSETS],
    disclosureTitle: "UAE lending disclosure",
    disclosureBody:
      "Interest-free lending with a fixed service fee, governed liquidation review, and custody-aware repayment servicing.",
    serviceFeeRateBps: 200,
    minPrincipalUsd: "500",
    maxPrincipalUsd: "100000",
    minimumTermMonths: 1,
    maximumTermMonths: 12,
    initialLtvBps: 6896,
    warningLtvBps: 7200,
    liquidationLtvBps: 8400,
    gracePeriodDays: 7,
    requiredApproverRoles: ["risk_manager", "compliance_lead"],
    liquidationApproverRoles: ["risk_manager", "compliance_lead"]
  },
  usa: {
    jurisdiction: "usa",
    displayName: "United States",
    currency: "USD",
    supportedBorrowSymbols: [...SUPPORTED_BORROW_ASSETS],
    supportedCollateralSymbols: [...SUPPORTED_COLLATERAL_ASSETS],
    disclosureTitle: "US lending disclosure",
    disclosureBody:
      "Interest-free lending with a disclosed fixed service fee, operator-reviewed origination, and explicit default handling.",
    serviceFeeRateBps: 275,
    minPrincipalUsd: "500",
    maxPrincipalUsd: "100000",
    minimumTermMonths: 1,
    maximumTermMonths: 9,
    initialLtvBps: 6452,
    warningLtvBps: 6800,
    liquidationLtvBps: 8000,
    gracePeriodDays: 10,
    requiredApproverRoles: ["risk_manager", "compliance_lead"],
    liquidationApproverRoles: ["risk_manager", "compliance_lead"]
  }
};

const NOTICE_REASON_COPY: Record<string, string> = {
  active: "Your loan is active and being serviced on its disclosed installment schedule.",
  grace_period: "A missed installment moved this loan into its grace period. Autopay will continue attempting collection before further operator action.",
  delinquent: "This loan is delinquent and is now under operator review.",
  defaulted: "This loan has defaulted and requires governed operator action.",
  liquidating: "Collateral liquidation has been approved and is in progress.",
  closed: "This loan is closed. Remaining collateral and statements stay available for audit."
};

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly readContract: ethers.Contract | null;
  private readonly writeContract: ethers.Contract | null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
    private readonly ledgerService: LedgerService,
    @Optional()
    private readonly solvencyService?: Pick<SolvencyService, "assertLoanFundingAllowed">
  ) {
    const runtimeConfig = loadOptionalBlockchainContractWriteRuntimeConfig();
    this.provider = createJsonRpcProvider(runtimeConfig.rpcUrl);

    if (!runtimeConfig.loanContractAddress) {
      this.readContract = null;
      this.writeContract = null;
      this.logger.warn(
        "Loan contract integration is disabled because LOAN_CONTRACT_ADDRESS is not configured."
      );
      return;
    }

    this.readContract = createLoanBookReadContract(
      runtimeConfig.loanContractAddress,
      this.provider
    );
    this.writeContract = runtimeConfig.ethereumPrivateKey
      ? createLoanBookWriteContract(
          runtimeConfig.loanContractAddress,
          new ethers.Wallet(runtimeConfig.ethereumPrivateKey, this.provider)
        )
      : null;
  }

  private normalizeOperatorRole(operatorRole?: string): string | null {
    const normalized = operatorRole?.trim().toLowerCase() ?? "";
    return normalized ? normalized : null;
  }

  private decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private toStringDecimal(value: Prisma.Decimal | number | null | undefined): string {
    if (value === null || typeof value === "undefined") {
      return "0";
    }

    return value instanceof Prisma.Decimal ? value.toString() : String(value);
  }

  private async getCustomerContext(
    supabaseUserId: string
  ): Promise<CustomerLoansContext> {
    const [accountProjection, walletProjection, balances] = await Promise.all([
      this.authService.getCustomerAccountProjectionBySupabaseUserId(supabaseUserId),
      this.authService.getCustomerWalletProjectionBySupabaseUserId(supabaseUserId),
      this.prismaService.customerAssetBalance.findMany({
        where: {
          customerAccount: {
            customer: {
              supabaseUserId
            }
          }
        },
        include: {
          asset: true
        },
        orderBy: {
          updatedAt: "desc"
        }
      })
    ]);

    return {
      customer: accountProjection.customer,
      customerAccount: accountProjection.customerAccount,
      wallet: walletProjection.wallet,
      balances: balances.map((balance) => ({
        asset: {
          id: balance.asset.id,
          symbol: balance.asset.symbol,
          displayName: balance.asset.displayName,
          decimals: balance.asset.decimals,
          chainId: balance.asset.chainId,
          assetType: balance.asset.assetType,
          contractAddress: balance.asset.contractAddress
        },
        availableBalance: balance.availableBalance,
        pendingBalance: balance.pendingBalance
      }))
    };
  }

  private async getSupportedLoanAssets(symbols: readonly string[]): Promise<LoanAssetRecord[]> {
    const assets = await this.prismaService.asset.findMany({
      where: {
        symbol: {
          in: [...symbols]
        }
      },
      orderBy: {
        symbol: "asc"
      }
    });

    if (assets.length !== symbols.length) {
      throw new NotFoundException("Loan assets are not fully configured.");
    }

    return assets;
  }

  private async getLoanApplicationOrThrow(loanApplicationId: string) {
    const loanApplication = await this.prismaService.loanApplication.findUnique({
      where: {
        id: loanApplicationId
      },
      include: {
        customerAccount: {
          include: {
            customer: true
          }
        },
        requestedBorrowAsset: true,
        requestedCollateralAsset: true,
        loanAgreement: {
          include: {
            installments: true,
            collateralPositions: true,
            liquidationCases: true
          }
        },
        events: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!loanApplication) {
      throw new NotFoundException("Loan application not found.");
    }

    return loanApplication;
  }

  private async getLoanAgreementOrThrow(loanAgreementId: string) {
    const loanAgreement = await this.prismaService.loanAgreement.findUnique({
      where: {
        id: loanAgreementId
      },
      include: {
        customerAccount: {
          include: {
            customer: true
          }
        },
        application: true,
        borrowAsset: true,
        collateralAsset: true,
        installments: {
          orderBy: {
            installmentNumber: "asc"
          }
        },
        repayments: {
          orderBy: {
            createdAt: "desc"
          }
        },
        collateralPositions: {
          orderBy: {
            createdAt: "asc"
          }
        },
        valuationSnapshots: {
          orderBy: {
            observedAt: "desc"
          },
          take: 4
        },
        liquidationCases: {
          orderBy: {
            createdAt: "desc"
          }
        },
        statements: {
          orderBy: {
            statementDate: "desc"
          },
          take: 6
        },
        events: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!loanAgreement) {
      throw new NotFoundException("Loan agreement not found.");
    }

    return loanAgreement;
  }

  private buildLoanTimeline(events: Array<{
    id: string;
    eventType: string;
    note: string | null;
    createdAt: Date;
    actorId: string | null;
    actorType: string;
  }>): SerializedTimelineEvent[] {
    return events.map((event) => ({
      id: event.id,
      label: event.eventType
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      tone:
        event.eventType.includes("fail") || event.eventType.includes("reject")
          ? "critical"
          : event.eventType.includes("liquidat") ||
              event.eventType.includes("grace") ||
              event.eventType.includes("delinquent")
            ? "warning"
            : event.eventType.includes("funded") ||
                event.eventType.includes("repaid") ||
                event.eventType.includes("closed")
              ? "positive"
              : "technical",
      timestamp: event.createdAt.toISOString(),
      description:
        event.note ??
        `${event.eventType.replace(/_/g, " ")} recorded by ${event.actorType} ${event.actorId ?? "system"}.`
    }));
  }

  private inferEligibility(context: CustomerLoansContext) {
    const managedEthBalance = context.balances.find(
      (balance) => balance.asset.symbol === "ETH"
    );
    const managedUsdcBalance = context.balances.find(
      (balance) => balance.asset.symbol === "USDC"
    );
    const accountReady = context.customerAccount.status === AccountLifecycleStatus.active;
    const custodyReady =
      context.wallet.status === WalletStatus.active &&
      context.wallet.custodyType === WalletCustodyType.platform_managed;
    const anyCollateralReady = Boolean(
      managedEthBalance?.availableBalance.greaterThan(0) ||
        managedUsdcBalance?.availableBalance.greaterThan(0)
    );

    return {
      eligible: accountReady && custodyReady && anyCollateralReady,
      accountReady,
      custodyReady,
      anyCollateralReady,
      reasons: [
        accountReady ? null : "Customer account must be active before loan servicing can start.",
        custodyReady
          ? null
          : "A platform-managed active wallet is required for loan disbursement, collateral custody, and autopay.",
        anyCollateralReady
          ? null
          : "At least one supported collateral asset must have an available managed balance."
      ].filter(Boolean),
      borrowingCapacity: {
        ETH: managedEthBalance?.availableBalance.toString() ?? "0",
        USDC: managedUsdcBalance?.availableBalance.toString() ?? "0"
      }
    };
  }

  private async resolveQuote(
    customerAccountId: string,
    dto: PreviewLoanQuoteDto
  ): Promise<
    LoanQuote & {
      applicationReferenceId: string;
      autopayEnabled: boolean;
      disclosureSummary: string;
      requestedCollateralRatioBps: number;
    }
  > {
    const policyPack =
      JURISDICTION_POLICY_PACKS[dto.jurisdiction] ??
      JURISDICTION_POLICY_PACKS.usa;
    const [borrowAsset, collateralAsset] = await Promise.all([
      this.prismaService.asset.findFirst({
        where: {
          symbol: dto.borrowAssetSymbol
        }
      }),
      this.prismaService.asset.findFirst({
        where: {
          symbol: dto.collateralAssetSymbol
        }
      })
    ]);

    if (!borrowAsset || !collateralAsset) {
      throw new NotFoundException("Supported loan asset configuration is missing.");
    }

    const borrowAmount = this.decimal(dto.borrowAmount);
    const collateralAmount = this.decimal(dto.collateralAmount);
    const termMonths = Number(dto.termMonths);

    if (borrowAmount.lessThanOrEqualTo(0) || collateralAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Borrow and collateral amounts must be greater than zero.");
    }

    if (
      termMonths < policyPack.minimumTermMonths ||
      termMonths > policyPack.maximumTermMonths
    ) {
      throw new BadRequestException(
        `Requested term exceeds the ${policyPack.displayName} lending policy pack.`
      );
    }

    const requestedCollateralRatioBps = collateralAmount
      .mul(10_000)
      .div(borrowAmount)
      .toNumber();

    const minimumCollateralRatioBps = Math.ceil(
      (10_000 * 10_000) / policyPack.initialLtvBps
    );

    if (requestedCollateralRatioBps < minimumCollateralRatioBps) {
      throw new BadRequestException(
        `Collateral must remain above the minimum ratio for ${policyPack.displayName}.`
      );
    }

    const serviceFeeAmount = borrowAmount
      .mul(policyPack.serviceFeeRateBps)
      .div(10_000);
    const totalRepayableAmount = borrowAmount.add(serviceFeeAmount);
    const installmentCount = termMonths;
    const installmentAmount = totalRepayableAmount.div(installmentCount);

    return {
      applicationReferenceId: `loan_quote_${customerAccountId.slice(-6)}_${dto.jurisdiction}`,
      jurisdiction: dto.jurisdiction,
      borrowAssetSymbol: borrowAsset.symbol,
      collateralAssetSymbol: collateralAsset.symbol,
      principalAmount: borrowAmount.toString(),
      collateralAmount: collateralAmount.toString(),
      serviceFeeAmount: serviceFeeAmount.toString(),
      totalRepayableAmount: totalRepayableAmount.toString(),
      installmentAmount: installmentAmount.toString(),
      installmentCount,
      termMonths,
      initialLtvBps: policyPack.initialLtvBps,
      warningLtvBps: policyPack.warningLtvBps,
      liquidationLtvBps: policyPack.liquidationLtvBps,
      gracePeriodDays: policyPack.gracePeriodDays,
      autopayEnabled: dto.autopayEnabled ?? true,
      disclosureSummary: policyPack.disclosureBody,
      policyPack,
      requestedCollateralRatioBps
    };
  }

  private async recordLoanEvent(
    transaction: Prisma.TransactionClient,
    input: {
      loanApplicationId?: string | null;
      loanAgreementId?: string | null;
      actorType: string;
      actorId?: string | null;
      actorRole?: string | null;
      eventType: string;
      note?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await transaction.loanEvent.create({
      data: {
        loanApplicationId: input.loanApplicationId ?? null,
        loanAgreementId: input.loanAgreementId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        eventType: input.eventType,
        note: input.note ?? null,
        metadata: (input.metadata ?? {}) as PrismaJsonValue
      }
    });
  }

  private async maybeCreateOnchainLoan(input: {
    walletAddress: string;
    borrowAsset: LoanAssetRecord;
    collateralAsset: LoanAssetRecord;
    principalAmount: string;
    collateralAmount: string;
    serviceFeeAmount: string;
    installmentAmount: string;
    installmentCount: number;
    termMonths: number;
    autopayEnabled: boolean;
  }): Promise<{ contractLoanId: string | null; transactionHash: string | null }> {
    if (!this.writeContract) {
      return {
        contractLoanId: null,
        transactionHash: null
      };
    }

    const borrower = input.walletAddress;
    const borrowAssetAddress =
      input.borrowAsset.assetType === AssetType.native
        ? ethers.constants.AddressZero
        : input.borrowAsset.contractAddress ?? ethers.constants.AddressZero;
    const collateralAssetAddress =
      input.collateralAsset.assetType === AssetType.native
        ? ethers.constants.AddressZero
        : input.collateralAsset.contractAddress ?? ethers.constants.AddressZero;

    const toUnits = (value: string, decimals: number) =>
      ethers.utils.parseUnits(value, decimals);

    const contractLoanId = await this.writeContract.callStatic.createLoan(
      borrower,
      borrowAssetAddress,
      collateralAssetAddress,
      toUnits(input.principalAmount, input.borrowAsset.decimals),
      toUnits(input.collateralAmount, input.collateralAsset.decimals),
      toUnits(input.serviceFeeAmount, input.borrowAsset.decimals),
      toUnits(input.installmentAmount, input.borrowAsset.decimals),
      input.installmentCount,
      input.termMonths,
      input.autopayEnabled
    );
    const tx = await this.writeContract.createLoan(
      borrower,
      borrowAssetAddress,
      collateralAssetAddress,
      toUnits(input.principalAmount, input.borrowAsset.decimals),
      toUnits(input.collateralAmount, input.collateralAsset.decimals),
      toUnits(input.serviceFeeAmount, input.borrowAsset.decimals),
      toUnits(input.installmentAmount, input.borrowAsset.decimals),
      input.installmentCount,
      input.termMonths,
      input.autopayEnabled
    );
    await tx.wait();

    return {
      contractLoanId: String(contractLoanId),
      transactionHash: tx.hash
    };
  }

  async getCustomerDashboard(supabaseUserId: string) {
    const context = await this.getCustomerContext(supabaseUserId);
    const [applications, agreements] = await Promise.all([
      this.prismaService.loanApplication.findMany({
        where: {
          customerAccountId: context.customerAccount.id
        },
        include: {
          requestedBorrowAsset: true,
          requestedCollateralAsset: true,
          loanAgreement: true,
          events: {
            orderBy: {
              createdAt: "desc"
            },
            take: 8
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 6
      }),
      this.prismaService.loanAgreement.findMany({
        where: {
          customerAccountId: context.customerAccount.id
        },
        include: {
          borrowAsset: true,
          collateralAsset: true,
          installments: {
            orderBy: {
              installmentNumber: "asc"
            }
          },
          collateralPositions: true,
          liquidationCases: {
            orderBy: {
              createdAt: "desc"
            },
            take: 3
          },
          statements: {
            orderBy: {
              statementDate: "desc"
            },
            take: 6
          },
          events: {
            orderBy: {
              createdAt: "desc"
            },
            take: 10
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      })
    ]);

    const eligibility = this.inferEligibility(context);

    return {
      account: {
        customerId: context.customer.id,
        customerAccountId: context.customerAccount.id,
        email: context.customer.email,
        walletAddress: context.wallet.address,
        accountStatus: context.customerAccount.status,
        walletStatus: context.wallet.status,
        custodyType: context.wallet.custodyType
      },
      eligibility,
      policyPacks: Object.values(JURISDICTION_POLICY_PACKS),
      supportedBorrowAssets: SUPPORTED_BORROW_ASSETS,
      supportedCollateralAssets: SUPPORTED_COLLATERAL_ASSETS,
      balances: context.balances.map((balance) => ({
        asset: balance.asset,
        availableBalance: balance.availableBalance.toString(),
        pendingBalance: balance.pendingBalance.toString()
      })),
      applications: applications.map((application) => ({
        id: application.id,
        status: application.status,
        jurisdiction: application.jurisdiction,
        requestedBorrowAmount: application.requestedBorrowAmount.toString(),
        requestedCollateralAmount: application.requestedCollateralAmount.toString(),
        requestedTermMonths: application.requestedTermMonths,
        serviceFeeAmount: application.serviceFeeAmount.toString(),
        borrowAsset: {
          symbol: application.requestedBorrowAsset.symbol,
          displayName: application.requestedBorrowAsset.displayName
        },
        collateralAsset: {
          symbol: application.requestedCollateralAsset.symbol,
          displayName: application.requestedCollateralAsset.displayName
        },
        submittedAt: application.submittedAt?.toISOString() ?? application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        note: application.decisionNote ?? application.failureReason,
        linkedLoanAgreementId: application.loanAgreement?.id ?? null,
        timeline: this.buildLoanTimeline(application.events)
      })),
      agreements: agreements.map((agreement) => ({
        id: agreement.id,
        applicationId: agreement.applicationId,
        status: agreement.status,
        jurisdiction: agreement.jurisdiction,
        principalAmount: agreement.principalAmount.toString(),
        collateralAmount: agreement.collateralAmount.toString(),
        serviceFeeAmount: agreement.serviceFeeAmount.toString(),
        outstandingPrincipalAmount: agreement.outstandingPrincipalAmount.toString(),
        outstandingServiceFeeAmount: agreement.outstandingServiceFeeAmount.toString(),
        outstandingTotalAmount: agreement.outstandingTotalAmount.toString(),
        installmentAmount: agreement.installmentAmount.toString(),
        installmentCount: agreement.installmentCount,
        termMonths: agreement.termMonths,
        autopayEnabled: agreement.autopayEnabled,
        borrowAsset: {
          symbol: agreement.borrowAsset.symbol,
          displayName: agreement.borrowAsset.displayName
        },
        collateralAsset: {
          symbol: agreement.collateralAsset.symbol,
          displayName: agreement.collateralAsset.displayName
        },
        nextDueAt: agreement.nextDueAt?.toISOString() ?? null,
        fundedAt: agreement.fundedAt?.toISOString() ?? null,
        activatedAt: agreement.activatedAt?.toISOString() ?? null,
        gracePeriodEndsAt: agreement.gracePeriodEndsAt?.toISOString() ?? null,
        statementReferences: agreement.statements.map((statement) => ({
          id: statement.id,
          referenceId: statement.referenceId,
          statementDate: statement.statementDate.toISOString()
        })),
        collateralPositions: agreement.collateralPositions.map((position) => ({
          id: position.id,
          assetId: position.assetId,
          amount: position.amount.toString(),
          status: position.status,
          walletAddress: position.walletAddress,
          currentValuationUsd: position.currentValuationUsd?.toString() ?? null,
          latestLtvBps: position.latestLtvBps ?? null
        })),
        installments: agreement.installments.map((installment) => ({
          id: installment.id,
          installmentNumber: installment.installmentNumber,
          dueAt: installment.dueAt.toISOString(),
          status: installment.status,
          scheduledPrincipalAmount: installment.scheduledPrincipalAmount.toString(),
          scheduledServiceFeeAmount: installment.scheduledServiceFeeAmount.toString(),
          scheduledTotalAmount: installment.scheduledTotalAmount.toString(),
          paidTotalAmount: installment.paidTotalAmount.toString()
        })),
        liquidationCases: agreement.liquidationCases.map((item) => ({
          id: item.id,
          status: item.status,
          reasonCode: item.reasonCode,
          recoveredAmount: item.recoveredAmount?.toString() ?? null,
          shortfallAmount: item.shortfallAmount?.toString() ?? null,
          updatedAt: item.updatedAt.toISOString()
        })),
        timeline: this.buildLoanTimeline(agreement.events),
        notice: NOTICE_REASON_COPY[agreement.status] ?? NOTICE_REASON_COPY.active
      }))
    };
  }

  async previewQuote(supabaseUserId: string, dto: PreviewLoanQuoteDto) {
    const context = await this.getCustomerContext(supabaseUserId);
    return this.resolveQuote(context.customerAccount.id, dto);
  }

  async createApplication(supabaseUserId: string, dto: CreateLoanApplicationDto) {
    const context = await this.getCustomerContext(supabaseUserId);
    const eligibility = this.inferEligibility(context);

    if (!eligibility.eligible) {
      throw new ConflictException(
        "Customer account is not currently eligible for managed lending."
      );
    }

    if (!dto.acceptServiceFeeDisclosure) {
      throw new BadRequestException("Service fee disclosure must be accepted.");
    }

    const quote = await this.resolveQuote(context.customerAccount.id, dto);
    const [borrowAsset, collateralAsset] = await this.getSupportedLoanAssets([
      dto.borrowAssetSymbol,
      dto.collateralAssetSymbol
    ]);

    const created = await this.prismaService.$transaction(async (transaction) => {
      const loanApplication = await transaction.loanApplication.create({
        data: {
          customerAccountId: context.customerAccount.id,
          status: LoanLifecycleStatus.submitted,
          jurisdiction: dto.jurisdiction,
          requestedBorrowAssetId: borrowAsset.id,
          requestedCollateralAssetId: collateralAsset.id,
          requestedBorrowAmount: this.decimal(dto.borrowAmount),
          requestedCollateralAmount: this.decimal(dto.collateralAmount),
          requestedTermMonths: Number(dto.termMonths),
          serviceFeeAmount: this.decimal(quote.serviceFeeAmount),
          autopayEnabled: dto.autopayEnabled ?? true,
          submittedAt: new Date(),
          quoteSnapshot: {
            ...quote,
            disclosureAcknowledgement: dto.disclosureAcknowledgement,
            supportNote: dto.supportNote ?? null
          } as PrismaJsonValue
        }
      });

      await this.recordLoanEvent(transaction, {
        loanApplicationId: loanApplication.id,
        actorType: "customer",
        actorId: context.customer.supabaseUserId,
        eventType: "submitted",
        note: dto.supportNote ?? "Customer submitted a managed lending application.",
        metadata: {
          jurisdiction: dto.jurisdiction,
          borrowAssetSymbol: borrowAsset.symbol,
          collateralAssetSymbol: collateralAsset.symbol
        }
      });

      return loanApplication;
    });

    return {
      applicationId: created.id,
      status: created.status,
      quote
    };
  }

  async getCustomerLoanDetail(supabaseUserId: string, loanAgreementId: string) {
    const context = await this.getCustomerContext(supabaseUserId);
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);

    if (agreement.customerAccountId !== context.customerAccount.id) {
      throw new NotFoundException("Loan agreement not found for this customer.");
    }

    return {
      loanAgreementId: agreement.id,
      status: agreement.status,
      jurisdiction: agreement.jurisdiction,
      principalAmount: agreement.principalAmount.toString(),
      collateralAmount: agreement.collateralAmount.toString(),
      serviceFeeAmount: agreement.serviceFeeAmount.toString(),
      outstandingTotalAmount: agreement.outstandingTotalAmount.toString(),
      autopayEnabled: agreement.autopayEnabled,
      borrowAsset: agreement.borrowAsset,
      collateralAsset: agreement.collateralAsset,
      notice: NOTICE_REASON_COPY[agreement.status] ?? NOTICE_REASON_COPY.active,
      contractLoanId: agreement.contractLoanId,
      contractAddress: agreement.contractAddress,
      installments: agreement.installments.map((installment) => ({
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        dueAt: installment.dueAt.toISOString(),
        status: installment.status,
        scheduledTotalAmount: installment.scheduledTotalAmount.toString(),
        paidTotalAmount: installment.paidTotalAmount.toString()
      })),
      repayments: agreement.repayments.map((repayment) => ({
        id: repayment.id,
        status: repayment.status,
        amount: repayment.amount.toString(),
        principalAppliedAmount: repayment.principalAppliedAmount.toString(),
        serviceFeeAppliedAmount: repayment.serviceFeeAppliedAmount.toString(),
        createdAt: repayment.createdAt.toISOString(),
        settledAt: repayment.settledAt?.toISOString() ?? null,
        failureReason: repayment.failureReason
      })),
      collateralPositions: agreement.collateralPositions.map((position) => ({
        id: position.id,
        assetId: position.assetId,
        amount: position.amount.toString(),
        status: position.status,
        walletAddress: position.walletAddress,
        currentValuationUsd: position.currentValuationUsd?.toString() ?? null,
        latestLtvBps: position.latestLtvBps
      })),
      statements: agreement.statements.map((statement) => ({
        id: statement.id,
        referenceId: statement.referenceId,
        statementDate: statement.statementDate.toISOString(),
        summarySnapshot: statement.summarySnapshot
      })),
      liquidationCases: agreement.liquidationCases.map((item) => ({
        id: item.id,
        status: item.status,
        reasonCode: item.reasonCode,
        note: item.note,
        recoveredAmount: item.recoveredAmount?.toString() ?? null,
        shortfallAmount: item.shortfallAmount?.toString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      })),
      timeline: this.buildLoanTimeline(agreement.events)
    };
  }

  async setCustomerAutopayPreference(
    supabaseUserId: string,
    loanAgreementId: string,
    enabled: boolean,
    note?: string
  ) {
    const context = await this.getCustomerContext(supabaseUserId);
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);

    if (agreement.customerAccountId !== context.customerAccount.id) {
      throw new NotFoundException("Loan agreement not found for this customer.");
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const record = await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          autopayEnabled: enabled
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "customer",
        actorId: context.customer.supabaseUserId,
        eventType: enabled ? "autopay_enabled" : "autopay_disabled",
        note: note ?? "Customer changed the autopay servicing preference."
      });

      return record;
    });

    return {
      loanAgreementId: updated.id,
      autopayEnabled: updated.autopayEnabled
    };
  }

  async getOperatorSummary() {
    const [applications, agreements, liquidations] = await Promise.all([
      this.prismaService.loanApplication.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.prismaService.loanAgreement.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.prismaService.loanLiquidationCase.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      })
    ]);

    return {
      applicationBacklog: applications.map((item) => ({
        status: item.status,
        count: item._count._all
      })),
      agreementStates: agreements.map((item) => ({
        status: item.status,
        count: item._count._all
      })),
      liquidationStates: liquidations.map((item) => ({
        status: item.status,
        count: item._count._all
      })),
      policyPacks: Object.values(JURISDICTION_POLICY_PACKS)
    };
  }

  async listOperatorApplications(query: ListOperatorLoanApplicationsDto) {
    const where: Prisma.LoanApplicationWhereInput = {};

    if (query.status) {
      where.status = query.status as LoanLifecycleStatus;
    }

    if (query.search?.trim()) {
      where.OR = [
        {
          id: {
            contains: query.search.trim(),
            mode: "insensitive"
          }
        },
        {
          customerAccount: {
            customer: {
              email: {
                contains: query.search.trim(),
                mode: "insensitive"
              }
            }
          }
        }
      ];
    }

    const [applications, totalCount] = await Promise.all([
      this.prismaService.loanApplication.findMany({
        where,
        include: {
          customerAccount: {
            include: {
              customer: true
            }
          },
          requestedBorrowAsset: true,
          requestedCollateralAsset: true,
          loanAgreement: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: query.limit
      }),
      this.prismaService.loanApplication.count({ where })
    ]);

    return {
      applications: applications.map((application) => ({
        id: application.id,
        status: application.status,
        jurisdiction: application.jurisdiction,
        requestedBorrowAmount: application.requestedBorrowAmount.toString(),
        requestedCollateralAmount: application.requestedCollateralAmount.toString(),
        requestedTermMonths: application.requestedTermMonths,
        serviceFeeAmount: application.serviceFeeAmount.toString(),
        customer: {
          customerId: application.customerAccount.customer.id,
          customerAccountId: application.customerAccount.id,
          email: application.customerAccount.customer.email,
          firstName: application.customerAccount.customer.firstName,
          lastName: application.customerAccount.customer.lastName
        },
        borrowAsset: {
          symbol: application.requestedBorrowAsset.symbol,
          displayName: application.requestedBorrowAsset.displayName
        },
        collateralAsset: {
          symbol: application.requestedCollateralAsset.symbol,
          displayName: application.requestedCollateralAsset.displayName
        },
        linkedLoanAgreementId: application.loanAgreement?.id ?? null,
        submittedAt: application.submittedAt?.toISOString() ?? application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString()
      })),
      totalCount,
      limit: query.limit
    };
  }

  async getOperatorApplicationWorkspace(loanApplicationId: string) {
    const application = await this.getLoanApplicationOrThrow(loanApplicationId);

    return {
      application: {
        id: application.id,
        status: application.status,
        jurisdiction: application.jurisdiction,
        requestedBorrowAmount: application.requestedBorrowAmount.toString(),
        requestedCollateralAmount: application.requestedCollateralAmount.toString(),
        requestedTermMonths: application.requestedTermMonths,
        serviceFeeAmount: application.serviceFeeAmount.toString(),
        autopayEnabled: application.autopayEnabled,
        quoteSnapshot: application.quoteSnapshot,
        submittedAt: application.submittedAt?.toISOString() ?? application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        reviewedByOperatorId: application.reviewedByOperatorId,
        reviewedByOperatorRole: application.reviewedByOperatorRole,
        decisionNote: application.decisionNote,
        customer: {
          customerId: application.customerAccount.customer.id,
          customerAccountId: application.customerAccount.id,
          status: application.customerAccount.status,
          email: application.customerAccount.customer.email,
          firstName: application.customerAccount.customer.firstName,
          lastName: application.customerAccount.customer.lastName
        },
        borrowAsset: application.requestedBorrowAsset,
        collateralAsset: application.requestedCollateralAsset
      },
      linkedLoanAgreement:
        application.loanAgreement === null
          ? null
          : {
              id: application.loanAgreement.id,
              status: application.loanAgreement.status,
              principalAmount: application.loanAgreement.principalAmount.toString(),
              outstandingTotalAmount:
                application.loanAgreement.outstandingTotalAmount.toString(),
              nextDueAt: application.loanAgreement.nextDueAt?.toISOString() ?? null
            },
      timeline: this.buildLoanTimeline(application.events)
    };
  }

  private buildInstallmentSchedule(input: {
    principalAmount: Prisma.Decimal;
    serviceFeeAmount: Prisma.Decimal;
    installmentCount: number;
  }) {
    const scheduledServiceFeeAmount = input.serviceFeeAmount.div(input.installmentCount);
    const scheduledPrincipalAmount = input.principalAmount.div(input.installmentCount);
    const scheduledTotalAmount = scheduledPrincipalAmount.add(scheduledServiceFeeAmount);

    return Array.from({ length: input.installmentCount }, (_, index) => ({
      installmentNumber: index + 1,
      scheduledPrincipalAmount,
      scheduledServiceFeeAmount,
      scheduledTotalAmount
    }));
  }

  async requestMoreEvidence(
    loanApplicationId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const updated = await this.prismaService.$transaction(async (transaction) => {
      const application = await transaction.loanApplication.update({
        where: {
          id: loanApplicationId
        },
        data: {
          status: LoanLifecycleStatus.under_review,
          reviewedAt: new Date(),
          reviewedByOperatorId: operatorId,
          reviewedByOperatorRole: this.normalizeOperatorRole(operatorRole),
          decisionNote:
            dto.note ?? "Additional evidence requested before a governed lending decision."
        }
      });

      await this.recordLoanEvent(transaction, {
        loanApplicationId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "evidence_requested",
        note: dto.note
      });

      return application;
    });

    return {
      loanApplicationId: updated.id,
      status: updated.status
    };
  }

  async approveApplication(
    loanApplicationId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    await this.solvencyService?.assertLoanFundingAllowed?.();
    const application = await this.getLoanApplicationOrThrow(loanApplicationId);

    if (application.status === LoanLifecycleStatus.rejected) {
      throw new ConflictException("Rejected loan applications cannot be approved.");
    }

    if (application.loanAgreement) {
      return {
        loanApplicationId: application.id,
        status: application.status,
        loanAgreementId: application.loanAgreement.id,
        reused: true
      };
    }

    const walletProjection = await this.authService.getCustomerWalletProjectionBySupabaseUserId(
      application.customerAccount.customer.supabaseUserId
    );
    const borrowAsset: LoanAssetRecord = {
      id: application.requestedBorrowAsset.id,
      symbol: application.requestedBorrowAsset.symbol,
      displayName: application.requestedBorrowAsset.displayName,
      decimals: application.requestedBorrowAsset.decimals,
      chainId: application.requestedBorrowAsset.chainId,
      assetType: application.requestedBorrowAsset.assetType,
      contractAddress: application.requestedBorrowAsset.contractAddress
    };
    const collateralAsset: LoanAssetRecord = {
      id: application.requestedCollateralAsset.id,
      symbol: application.requestedCollateralAsset.symbol,
      displayName: application.requestedCollateralAsset.displayName,
      decimals: application.requestedCollateralAsset.decimals,
      chainId: application.requestedCollateralAsset.chainId,
      assetType: application.requestedCollateralAsset.assetType,
      contractAddress: application.requestedCollateralAsset.contractAddress
    };
    const schedule = this.buildInstallmentSchedule({
      principalAmount: application.requestedBorrowAmount,
      serviceFeeAmount: application.serviceFeeAmount,
      installmentCount: application.requestedTermMonths
    });
    const onchain = await this.maybeCreateOnchainLoan({
      walletAddress: walletProjection.wallet.address,
      borrowAsset,
      collateralAsset,
      principalAmount: application.requestedBorrowAmount.toString(),
      collateralAmount: application.requestedCollateralAmount.toString(),
      serviceFeeAmount: application.serviceFeeAmount.toString(),
      installmentAmount: schedule[0]?.scheduledTotalAmount.toString() ?? "0",
      installmentCount: application.requestedTermMonths,
      termMonths: application.requestedTermMonths,
      autopayEnabled: application.autopayEnabled
    });

    const result = await this.prismaService.$transaction(async (transaction) => {
      const approvalTime = new Date();
      const nextDueAt = new Date(approvalTime);
      nextDueAt.setMonth(nextDueAt.getMonth() + 1);

      const updatedApplication = await transaction.loanApplication.update({
        where: {
          id: loanApplicationId
        },
        data: {
          status: LoanLifecycleStatus.approved,
          reviewedAt: approvalTime,
          reviewedByOperatorId: operatorId,
          reviewedByOperatorRole: this.normalizeOperatorRole(operatorRole),
          decisionNote: dto.note ?? "Application approved for governed funding."
        }
      });

      const agreement = await transaction.loanAgreement.create({
        data: {
          applicationId: updatedApplication.id,
          customerAccountId: updatedApplication.customerAccountId,
          status: LoanLifecycleStatus.awaiting_funding,
          jurisdiction: updatedApplication.jurisdiction,
          borrowAssetId: updatedApplication.requestedBorrowAssetId,
          collateralAssetId: updatedApplication.requestedCollateralAssetId,
          principalAmount: updatedApplication.requestedBorrowAmount,
          collateralAmount: updatedApplication.requestedCollateralAmount,
          serviceFeeAmount: updatedApplication.serviceFeeAmount,
          totalRepayableAmount: updatedApplication.requestedBorrowAmount.add(
            updatedApplication.serviceFeeAmount
          ),
          outstandingPrincipalAmount: updatedApplication.requestedBorrowAmount,
          outstandingServiceFeeAmount: updatedApplication.serviceFeeAmount,
          outstandingTotalAmount: updatedApplication.requestedBorrowAmount.add(
            updatedApplication.serviceFeeAmount
          ),
          installmentAmount: schedule[0]?.scheduledTotalAmount ?? updatedApplication.requestedBorrowAmount,
          installmentCount: updatedApplication.requestedTermMonths,
          termMonths: updatedApplication.requestedTermMonths,
          autopayEnabled: updatedApplication.autopayEnabled,
          contractLoanId: onchain.contractLoanId,
          contractAddress: this.writeContract?.address ?? null,
          activationTransactionHash: onchain.transactionHash,
          approvedAt: approvalTime,
          nextDueAt,
          disclosureSnapshot: updatedApplication.quoteSnapshot as PrismaJsonValue
        }
      });

      await transaction.loanInstallment.createMany({
        data: schedule.map((item, index) => {
          const dueAt = new Date(approvalTime);
          dueAt.setMonth(dueAt.getMonth() + index + 1);

          return {
            loanAgreementId: agreement.id,
            installmentNumber: item.installmentNumber,
            dueAt,
            status: index === 0 ? LoanInstallmentStatus.due : LoanInstallmentStatus.scheduled,
            scheduledPrincipalAmount: item.scheduledPrincipalAmount,
            scheduledServiceFeeAmount: item.scheduledServiceFeeAmount,
            scheduledTotalAmount: item.scheduledTotalAmount
          };
        })
      });

      await transaction.loanCollateralPosition.create({
        data: {
          loanAgreementId: agreement.id,
          assetId: updatedApplication.requestedCollateralAssetId,
          amount: updatedApplication.requestedCollateralAmount,
          status: LoanCollateralStatus.pending_lock,
          walletAddress: walletProjection.wallet.address
        }
      });

      await transaction.loanStatement.create({
        data: {
          loanAgreementId: agreement.id,
          customerAccountId: updatedApplication.customerAccountId,
          referenceId: `loan_stmt_${randomUUID().slice(0, 12)}`,
          statementDate: approvalTime,
          summarySnapshot: {
            status: agreement.status,
            principalAmount: agreement.principalAmount.toString(),
            serviceFeeAmount: agreement.serviceFeeAmount.toString(),
            outstandingTotalAmount: agreement.outstandingTotalAmount.toString()
          } as PrismaJsonValue
        }
      });

      await this.recordLoanEvent(transaction, {
        loanApplicationId,
        loanAgreementId: agreement.id,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "approved",
        note: dto.note
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId: agreement.id,
        actorType: "system",
        eventType: "agreement_created",
        note: "Loan agreement created and scheduled for funding."
      });

      return {
        application: updatedApplication,
        agreement
      };
    });

    return {
      loanApplicationId: result.application.id,
      status: result.application.status,
      loanAgreementId: result.agreement.id,
      contractLoanId: result.agreement.contractLoanId,
      reused: false
    };
  }

  async rejectApplication(
    loanApplicationId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const updated = await this.prismaService.$transaction(async (transaction) => {
      const application = await transaction.loanApplication.update({
        where: {
          id: loanApplicationId
        },
        data: {
          status: LoanLifecycleStatus.rejected,
          reviewedAt: new Date(),
          reviewedByOperatorId: operatorId,
          reviewedByOperatorRole: this.normalizeOperatorRole(operatorRole),
          decisionNote: dto.note ?? "Application rejected by operator review.",
          failureReason: dto.reasonCode ?? "underwriting_rejection"
        }
      });

      await this.recordLoanEvent(transaction, {
        loanApplicationId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "rejected",
        note: dto.note
      });

      return application;
    });

    return {
      loanApplicationId: updated.id,
      status: updated.status
    };
  }

  async placeAccountRestriction(
    loanApplicationId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const application = await this.getLoanApplicationOrThrow(loanApplicationId);

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const customerAccount = await transaction.customerAccount.update({
        where: {
          id: application.customerAccountId
        },
        data: {
          status: AccountLifecycleStatus.restricted,
          restrictedAt: new Date(),
          restrictedFromStatus: application.customerAccount.status,
          restrictionReasonCode: dto.reasonCode ?? "loan_risk_restriction",
          restrictedByOperatorId: operatorId
        }
      });

      await this.recordLoanEvent(transaction, {
        loanApplicationId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "account_restricted",
        note: dto.note
      });

      return customerAccount;
    });

    return {
      customerAccountId: updated.id,
      status: updated.status
    };
  }

  async listOperatorAgreements(query: ListOperatorLoanAgreementsDto) {
    const where: Prisma.LoanAgreementWhereInput = query.status
      ? {
          status: query.status as LoanLifecycleStatus
        }
      : {};

    const [agreements, totalCount] = await Promise.all([
      this.prismaService.loanAgreement.findMany({
        where,
        include: {
          customerAccount: {
            include: {
              customer: true
            }
          },
          borrowAsset: true,
          collateralAsset: true,
          collateralPositions: true,
          liquidationCases: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: query.limit
      }),
      this.prismaService.loanAgreement.count({ where })
    ]);

    return {
      agreements: agreements.map((agreement) => ({
        id: agreement.id,
        status: agreement.status,
        jurisdiction: agreement.jurisdiction,
        principalAmount: agreement.principalAmount.toString(),
        collateralAmount: agreement.collateralAmount.toString(),
        outstandingTotalAmount: agreement.outstandingTotalAmount.toString(),
        autopayEnabled: agreement.autopayEnabled,
        nextDueAt: agreement.nextDueAt?.toISOString() ?? null,
        customer: {
          customerId: agreement.customerAccount.customer.id,
          customerAccountId: agreement.customerAccount.id,
          email: agreement.customerAccount.customer.email,
          firstName: agreement.customerAccount.customer.firstName,
          lastName: agreement.customerAccount.customer.lastName
        },
        borrowAsset: agreement.borrowAsset.symbol,
        collateralAsset: agreement.collateralAsset.symbol,
        collateralStatus: agreement.collateralPositions[0]?.status ?? null,
        liquidationStatus: agreement.liquidationCases[0]?.status ?? null
      })),
      totalCount,
      limit: query.limit
    };
  }

  async getOperatorAgreementWorkspace(loanAgreementId: string) {
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);

    return {
      agreement: {
        id: agreement.id,
        applicationId: agreement.applicationId,
        status: agreement.status,
        jurisdiction: agreement.jurisdiction,
        principalAmount: agreement.principalAmount.toString(),
        collateralAmount: agreement.collateralAmount.toString(),
        serviceFeeAmount: agreement.serviceFeeAmount.toString(),
        outstandingTotalAmount: agreement.outstandingTotalAmount.toString(),
        contractLoanId: agreement.contractLoanId,
        contractAddress: agreement.contractAddress,
        activationTransactionHash: agreement.activationTransactionHash,
        autopayEnabled: agreement.autopayEnabled,
        nextDueAt: agreement.nextDueAt?.toISOString() ?? null,
        gracePeriodEndsAt: agreement.gracePeriodEndsAt?.toISOString() ?? null,
        delinquentAt: agreement.delinquentAt?.toISOString() ?? null,
        defaultedAt: agreement.defaultedAt?.toISOString() ?? null,
        liquidationStartedAt: agreement.liquidationStartedAt?.toISOString() ?? null,
        customer: {
          customerId: agreement.customerAccount.customer.id,
          customerAccountId: agreement.customerAccount.id,
          status: agreement.customerAccount.status,
          email: agreement.customerAccount.customer.email,
          firstName: agreement.customerAccount.customer.firstName,
          lastName: agreement.customerAccount.customer.lastName
        },
        borrowAsset: agreement.borrowAsset,
        collateralAsset: agreement.collateralAsset
      },
      installments: agreement.installments.map((installment) => ({
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        dueAt: installment.dueAt.toISOString(),
        status: installment.status,
        scheduledTotalAmount: installment.scheduledTotalAmount.toString(),
        paidTotalAmount: installment.paidTotalAmount.toString(),
        lastAutopayAttemptAt: installment.lastAutopayAttemptAt?.toISOString() ?? null
      })),
      collateralPositions: agreement.collateralPositions.map((position) => ({
        id: position.id,
        amount: position.amount.toString(),
        status: position.status,
        walletAddress: position.walletAddress,
        currentValuationUsd: position.currentValuationUsd?.toString() ?? null,
        latestLtvBps: position.latestLtvBps
      })),
      valuations: agreement.valuationSnapshots.map((snapshot) => ({
        id: snapshot.id,
        priceUsd: snapshot.priceUsd.toString(),
        collateralValueUsd: snapshot.collateralValueUsd.toString(),
        principalValueUsd: snapshot.principalValueUsd.toString(),
        ltvBps: snapshot.ltvBps,
        observedAt: snapshot.observedAt.toISOString()
      })),
      repayments: agreement.repayments.map((repayment) => ({
        id: repayment.id,
        status: repayment.status,
        amount: repayment.amount.toString(),
        principalAppliedAmount: repayment.principalAppliedAmount.toString(),
        serviceFeeAppliedAmount: repayment.serviceFeeAppliedAmount.toString(),
        failureReason: repayment.failureReason,
        autopayAttempted: repayment.autopayAttempted,
        autopaySucceeded: repayment.autopaySucceeded,
        createdAt: repayment.createdAt.toISOString(),
        settledAt: repayment.settledAt?.toISOString() ?? null
      })),
      statements: agreement.statements.map((statement) => ({
        id: statement.id,
        referenceId: statement.referenceId,
        statementDate: statement.statementDate.toISOString()
      })),
      liquidationCases: agreement.liquidationCases.map((item) => ({
        id: item.id,
        status: item.status,
        reasonCode: item.reasonCode,
        note: item.note,
        executionTransactionHash: item.executionTransactionHash,
        recoveredAmount: item.recoveredAmount?.toString() ?? null,
        shortfallAmount: item.shortfallAmount?.toString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      })),
      timeline: this.buildLoanTimeline(agreement.events)
    };
  }

  async startLiquidationReview(
    loanAgreementId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);

    if (
      ![
        LoanLifecycleStatus.delinquent,
        LoanLifecycleStatus.defaulted,
        LoanLifecycleStatus.grace_period
      ].some((status) => status === agreement.status)
    ) {
      throw new ConflictException(
        "Only grace-period, delinquent, or defaulted loans can enter liquidation review."
      );
    }

    const result = await this.prismaService.$transaction(async (transaction) => {
      const liquidationCase = await transaction.loanLiquidationCase.create({
        data: {
          loanAgreementId,
          status: LoanLiquidationStatus.review_requested,
          reasonCode: dto.reasonCode ?? "ltv_breach",
          requestedByOperatorId: operatorId,
          note: dto.note ?? "Collateral liquidation review requested."
        }
      });

      await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: LoanLifecycleStatus.defaulted,
          liquidationStartedAt: new Date()
        }
      });

      await transaction.loanCollateralPosition.updateMany({
        where: {
          loanAgreementId
        },
        data: {
          status: LoanCollateralStatus.liquidation_review
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "liquidation_review_started",
        note: dto.note
      });

      return liquidationCase;
    });

    return {
      liquidationCaseId: result.id,
      status: result.status
    };
  }

  async approveLiquidation(
    loanAgreementId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const result = await this.prismaService.$transaction(async (transaction) => {
      const liquidationCase = await transaction.loanLiquidationCase.findFirst({
        where: {
          loanAgreementId,
          status: LoanLiquidationStatus.review_requested
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (!liquidationCase) {
        throw new NotFoundException("No liquidation review is pending for this loan.");
      }

      const updatedCase = await transaction.loanLiquidationCase.update({
        where: {
          id: liquidationCase.id
        },
        data: {
          status: LoanLiquidationStatus.approved,
          approvedByOperatorId: operatorId,
          note: dto.note ?? liquidationCase.note
        }
      });

      await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: LoanLifecycleStatus.liquidating
        }
      });

      await transaction.loanCollateralPosition.updateMany({
        where: {
          loanAgreementId
        },
        data: {
          status: LoanCollateralStatus.liquidating
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "liquidation_approved",
        note: dto.note
      });

      return updatedCase;
    });

    return {
      liquidationCaseId: result.id,
      status: result.status
    };
  }

  async executeLiquidation(
    loanAgreementId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);
    const latestLiquidation = agreement.liquidationCases[0];

    if (!latestLiquidation || latestLiquidation.status !== LoanLiquidationStatus.approved) {
      throw new ConflictException("Liquidation must be approved before execution.");
    }

    const recoveredAmount = agreement.collateralAmount;
    const shortfallAmount = Prisma.Decimal.max(
      agreement.outstandingTotalAmount.sub(recoveredAmount),
      new Prisma.Decimal(0)
    );

    const result = await this.prismaService.$transaction(async (transaction) => {
      const updatedCase = await transaction.loanLiquidationCase.update({
        where: {
          id: latestLiquidation.id
        },
        data: {
          status: LoanLiquidationStatus.executed,
          executedByOperatorId: operatorId,
          executionTransactionHash: this.writeContract ? `synthetic:${randomUUID()}` : null,
          recoveredAmount,
          shortfallAmount,
          note: dto.note ?? latestLiquidation.note
        }
      });

      await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: LoanLifecycleStatus.closed,
          closedAt: new Date(),
          outstandingPrincipalAmount: new Prisma.Decimal(0),
          outstandingServiceFeeAmount: new Prisma.Decimal(0),
          outstandingTotalAmount: new Prisma.Decimal(0)
        }
      });

      await transaction.loanCollateralPosition.updateMany({
        where: {
          loanAgreementId
        },
        data: {
          status: LoanCollateralStatus.seized,
          seizedAt: new Date()
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "liquidation_executed",
        note: dto.note
      });

      return updatedCase;
    });

    return {
      liquidationCaseId: result.id,
      status: result.status
    };
  }

  async closeAgreement(
    loanAgreementId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: OperatorLoanActionDto
  ) {
    const result = await this.prismaService.$transaction(async (transaction) => {
      const agreement = await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: LoanLifecycleStatus.closed,
          closedAt: new Date(),
          outstandingPrincipalAmount: new Prisma.Decimal(0),
          outstandingServiceFeeAmount: new Prisma.Decimal(0),
          outstandingTotalAmount: new Prisma.Decimal(0)
        }
      });

      await transaction.loanCollateralPosition.updateMany({
        where: {
          loanAgreementId
        },
        data: {
          status: LoanCollateralStatus.released,
          releasedAt: new Date()
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "operator",
        actorId: operatorId,
        actorRole: this.normalizeOperatorRole(operatorRole),
        eventType: "closed",
        note: dto.note ?? "Agreement closed after repayment or operator settlement."
      });

      return agreement;
    });

    return {
      loanAgreementId: result.id,
      status: result.status
    };
  }

  async listAwaitingFunding(limit: number) {
    const agreements = await this.prismaService.loanAgreement.findMany({
      where: {
        status: LoanLifecycleStatus.awaiting_funding
      },
      include: {
        customerAccount: {
          include: {
            customer: true
          }
        },
        borrowAsset: true,
        collateralAsset: true,
        collateralPositions: true
      },
      orderBy: {
        approvedAt: "asc"
      },
      take: limit
    });

    return {
      agreements: agreements.map((agreement) => ({
        id: agreement.id,
        customerAccountId: agreement.customerAccountId,
        customerEmail: agreement.customerAccount.customer.email,
        principalAmount: agreement.principalAmount.toString(),
        collateralAmount: agreement.collateralAmount.toString(),
        borrowAsset: agreement.borrowAsset.symbol,
        collateralAsset: agreement.collateralAsset.symbol,
        approvedAt: agreement.approvedAt?.toISOString() ?? null,
        collateralStatus: agreement.collateralPositions[0]?.status ?? null
      })),
      limit
    };
  }

  async fundAgreement(loanAgreementId: string, workerId: string) {
    await this.solvencyService?.assertLoanFundingAllowed?.();
    const result = await this.prismaService.$transaction(async (transaction) => {
      const currentAgreement = await transaction.loanAgreement.findUnique({
        where: {
          id: loanAgreementId
        },
        select: {
          id: true,
          status: true,
          borrowAssetId: true,
          principalAmount: true,
          serviceFeeAmount: true,
          borrowAsset: {
            select: {
              chainId: true
            }
          }
        }
      });

      if (!currentAgreement) {
        throw new NotFoundException("Loan agreement not found.");
      }

      const ledgerResult = await this.ledgerService.recordLoanDisbursement(
        transaction,
        {
          loanAgreementId: currentAgreement.id,
          assetId: currentAgreement.borrowAssetId,
          chainId: currentAgreement.borrowAsset.chainId,
          principalAmount: currentAgreement.principalAmount,
          serviceFeeAmount: currentAgreement.serviceFeeAmount
        }
      );

      const agreement = await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: LoanLifecycleStatus.active,
          fundedAt: new Date(),
          activatedAt: new Date()
        }
      });

      await transaction.loanCollateralPosition.updateMany({
        where: {
          loanAgreementId
        },
        data: {
          status: LoanCollateralStatus.locked,
          lockedAt: new Date()
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "worker",
        actorId: workerId,
        eventType: "funded",
        note: "Funding workflow completed and the agreement is active.",
        metadata: {
          ledgerJournalId: ledgerResult.ledgerJournalId,
          principalReceivableLedgerAccountId:
            ledgerResult.principalReceivableLedgerAccountId,
          serviceFeeReceivableLedgerAccountId:
            ledgerResult.serviceFeeReceivableLedgerAccountId,
          serviceFeeIncomeLedgerAccountId:
            ledgerResult.serviceFeeIncomeLedgerAccountId,
          creditLedgerAccountId: ledgerResult.creditLedgerAccountId
        }
      });

      return agreement;
    });

    return {
      loanAgreementId: result.id,
      status: result.status
    };
  }

  async listDueInstallments(limit: number) {
    const installments = await this.prismaService.loanInstallment.findMany({
      where: {
        dueAt: {
          lte: new Date()
        },
        status: {
          in: [LoanInstallmentStatus.due, LoanInstallmentStatus.partial, LoanInstallmentStatus.missed]
        }
      },
      include: {
        loanAgreement: {
          include: {
            customerAccount: {
              include: {
                customer: true
              }
            },
            borrowAsset: true
          }
        }
      },
      orderBy: {
        dueAt: "asc"
      },
      take: limit
    });

    return {
      installments: installments.map((installment) => ({
        id: installment.id,
        loanAgreementId: installment.loanAgreementId,
        installmentNumber: installment.installmentNumber,
        dueAt: installment.dueAt.toISOString(),
        status: installment.status,
        amount: installment.scheduledTotalAmount.toString(),
        assetSymbol: installment.loanAgreement.borrowAsset.symbol,
        customerEmail: installment.loanAgreement.customerAccount.customer.email
      })),
      limit
    };
  }

  async runAutopay(loanAgreementId: string, workerId: string) {
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);
    const dueInstallment = agreement.installments.find(
      (installment) =>
        [
          LoanInstallmentStatus.due,
          LoanInstallmentStatus.partial,
          LoanInstallmentStatus.missed
        ].some((status) => status === installment.status) &&
        installment.dueAt <= new Date()
    );

    if (!dueInstallment) {
      return {
        loanAgreementId,
        attempted: false,
        reason: "No due installment is pending collection."
      };
    }

    if (!agreement.autopayEnabled) {
      return {
        loanAgreementId,
        attempted: false,
        reason: "Autopay is disabled for this agreement."
      };
    }

    const balance = await this.prismaService.customerAssetBalance.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: agreement.customerAccountId,
          assetId: agreement.borrowAssetId
        }
      }
    });

    const dueAmount = dueInstallment.scheduledTotalAmount.sub(dueInstallment.paidTotalAmount);

    if (!balance || balance.availableBalance.lessThan(dueAmount)) {
      const result = await this.prismaService.$transaction(async (transaction) => {
        await transaction.loanRepaymentEvent.create({
          data: {
            loanAgreementId,
            installmentId: dueInstallment.id,
            assetId: agreement.borrowAssetId,
            status: LoanRepaymentStatus.failed,
            amount: dueAmount,
            autopayAttempted: true,
            autopaySucceeded: false,
            failureReason: "Insufficient managed balance for autopay."
          }
        });

        await transaction.loanInstallment.update({
          where: {
            id: dueInstallment.id
          },
          data: {
            status: LoanInstallmentStatus.missed,
            lastAutopayAttemptAt: new Date()
          }
        });

        await transaction.loanAgreement.update({
          where: {
            id: loanAgreementId
          },
          data: {
            status: LoanLifecycleStatus.grace_period,
            gracePeriodEndsAt: (() => {
              const policy = JURISDICTION_POLICY_PACKS[agreement.jurisdiction];
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + policy.gracePeriodDays);
              return expiresAt;
            })()
          }
        });

        await this.recordLoanEvent(transaction, {
          loanAgreementId,
          actorType: "worker",
          actorId: workerId,
          eventType: "autopay_failed",
          note: "Autopay could not collect the due installment."
        });
      });

      return {
        loanAgreementId,
        attempted: true,
        succeeded: false,
        dueInstallmentId: dueInstallment.id
      };
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const repayment = await transaction.loanRepaymentEvent.create({
        data: {
          loanAgreementId,
          installmentId: dueInstallment.id,
          assetId: agreement.borrowAssetId,
          status: LoanRepaymentStatus.settled,
          amount: dueAmount,
          principalAppliedAmount: dueInstallment.scheduledPrincipalAmount,
          serviceFeeAppliedAmount: dueInstallment.scheduledServiceFeeAmount,
          autopayAttempted: true,
          autopaySucceeded: true,
          settledAt: new Date()
        }
      });

      const ledgerResult = await this.ledgerService.recordLoanRepayment(
        transaction,
        {
          loanAgreementId,
          loanRepaymentEventId: repayment.id,
          customerAccountId: agreement.customerAccountId,
          assetId: agreement.borrowAssetId,
          chainId: agreement.borrowAsset.chainId,
          principalAmount: dueInstallment.scheduledPrincipalAmount,
          serviceFeeAmount: dueInstallment.scheduledServiceFeeAmount,
          totalAmount: dueAmount
        }
      );

      const installment = await transaction.loanInstallment.update({
        where: {
          id: dueInstallment.id
        },
        data: {
          status: LoanInstallmentStatus.paid,
          paidPrincipalAmount: {
            increment: dueInstallment.scheduledPrincipalAmount
          },
          paidServiceFeeAmount: {
            increment: dueInstallment.scheduledServiceFeeAmount
          },
          paidTotalAmount: {
            increment: dueAmount
          },
          lastAutopayAttemptAt: new Date()
        }
      });

      const remainingPrincipal = agreement.outstandingPrincipalAmount.sub(
        dueInstallment.scheduledPrincipalAmount
      );
      const remainingFee = agreement.outstandingServiceFeeAmount.sub(
        dueInstallment.scheduledServiceFeeAmount
      );
      const nextInstallment = agreement.installments.find(
        (installmentCandidate) =>
          installmentCandidate.installmentNumber === dueInstallment.installmentNumber + 1
      );

      const loanStatus =
        remainingPrincipal.lessThanOrEqualTo(0) && remainingFee.lessThanOrEqualTo(0)
          ? LoanLifecycleStatus.closed
          : LoanLifecycleStatus.active;

      const nextDueAt =
        loanStatus === LoanLifecycleStatus.closed
          ? null
          : nextInstallment?.dueAt ?? agreement.nextDueAt;

      await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: loanStatus,
          outstandingPrincipalAmount: remainingPrincipal,
          outstandingServiceFeeAmount: remainingFee,
          outstandingTotalAmount: Prisma.Decimal.max(
            remainingPrincipal.add(remainingFee),
            new Prisma.Decimal(0)
          ),
          nextDueAt,
          gracePeriodEndsAt: null,
          closedAt: loanStatus === LoanLifecycleStatus.closed ? new Date() : null
        }
      });

      if (nextInstallment) {
        await transaction.loanInstallment.update({
          where: {
            id: nextInstallment.id
          },
          data: {
            status: LoanInstallmentStatus.due
          }
        });
      }

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "worker",
        actorId: workerId,
        eventType: "autopay_settled",
        note: "Managed autopay collected a scheduled installment.",
        metadata: {
          repaymentId: repayment.id,
          ledgerJournalId: ledgerResult.ledgerJournalId,
          debitLedgerAccountId: ledgerResult.debitLedgerAccountId,
          principalReceivableLedgerAccountId:
            ledgerResult.principalReceivableLedgerAccountId,
          serviceFeeReceivableLedgerAccountId:
            ledgerResult.serviceFeeReceivableLedgerAccountId,
          availableBalance: ledgerResult.availableBalance
        }
      });

      return {
        repayment,
        installment,
        status: loanStatus
      };
    });

    return {
      loanAgreementId,
      attempted: true,
      succeeded: true,
      repaymentId: updated.repayment.id,
      status: updated.status
    };
  }

  async refreshValuation(loanAgreementId: string, workerId: string) {
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);
    const policy = JURISDICTION_POLICY_PACKS[agreement.jurisdiction];
    const collateralValueUsd = agreement.collateralAmount;
    const principalValueUsd = agreement.outstandingTotalAmount;
    const ltvBps = principalValueUsd.lessThanOrEqualTo(0)
      ? 0
      : principalValueUsd.mul(10_000).div(collateralValueUsd).toNumber();
    const collateralStatus =
      ltvBps >= policy.liquidationLtvBps
        ? LoanCollateralStatus.liquidation_review
        : ltvBps >= policy.warningLtvBps
          ? LoanCollateralStatus.margin_warning
          : LoanCollateralStatus.locked;

    const snapshot = await this.prismaService.$transaction(async (transaction) => {
      const valuationSnapshot = await transaction.loanValuationSnapshot.create({
        data: {
          loanAgreementId,
          collateralPositionId: agreement.collateralPositions[0]?.id ?? null,
          priceUsd: new Prisma.Decimal(1),
          collateralValueUsd,
          principalValueUsd,
          ltvBps,
          warningLtvBps: policy.warningLtvBps,
          liquidationLtvBps: policy.liquidationLtvBps,
          observedAt: new Date()
        }
      });

      await transaction.loanCollateralPosition.updateMany({
        where: {
          loanAgreementId
        },
        data: {
          status: collateralStatus,
          currentValuationUsd: collateralValueUsd,
          latestLtvBps: ltvBps
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "worker",
        actorId: workerId,
        eventType:
          collateralStatus === LoanCollateralStatus.margin_warning
            ? "margin_warning"
            : collateralStatus === LoanCollateralStatus.liquidation_review
              ? "liquidation_threshold_reached"
              : "valuation_refreshed",
        note: `Collateral LTV refreshed to ${ltvBps} bps.`
      });

      return valuationSnapshot;
    });

    return {
      loanAgreementId,
      ltvBps: snapshot.ltvBps,
      observedAt: snapshot.observedAt.toISOString(),
      status:
        ltvBps >= policy.liquidationLtvBps
          ? "liquidation_review"
          : ltvBps >= policy.warningLtvBps
            ? "margin_warning"
            : "healthy"
    };
  }

  async listLiquidationCandidates(limit: number) {
    const agreements = await this.prismaService.loanAgreement.findMany({
      where: {
        OR: [
          {
            status: LoanLifecycleStatus.defaulted
          },
          {
            collateralPositions: {
              some: {
                status: LoanCollateralStatus.liquidation_review
              }
            }
          }
        ]
      },
      include: {
        customerAccount: {
          include: {
            customer: true
          }
        },
        collateralPositions: true,
        liquidationCases: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: limit
    });

    return {
      candidates: agreements.map((agreement) => ({
        loanAgreementId: agreement.id,
        customerEmail: agreement.customerAccount.customer.email,
        status: agreement.status,
        outstandingTotalAmount: agreement.outstandingTotalAmount.toString(),
        collateralStatus: agreement.collateralPositions[0]?.status ?? null,
        latestLtvBps: agreement.collateralPositions[0]?.latestLtvBps ?? null,
        latestLiquidationStatus: agreement.liquidationCases[0]?.status ?? null
      })),
      limit
    };
  }

  async listValuationMonitor(limit: number) {
    const agreements = await this.prismaService.loanAgreement.findMany({
      where: {
        status: {
          in: [
            LoanLifecycleStatus.active,
            LoanLifecycleStatus.grace_period,
            LoanLifecycleStatus.delinquent,
            LoanLifecycleStatus.defaulted,
            LoanLifecycleStatus.liquidating
          ]
        }
      },
      include: {
        customerAccount: {
          include: {
            customer: true
          }
        },
        collateralPositions: true
      },
      orderBy: {
        updatedAt: "asc"
      },
      take: limit
    });

    return {
      agreements: agreements.map((agreement) => ({
        loanAgreementId: agreement.id,
        customerEmail: agreement.customerAccount.customer.email,
        status: agreement.status,
        collateralStatus: agreement.collateralPositions[0]?.status ?? null,
        latestLtvBps: agreement.collateralPositions[0]?.latestLtvBps ?? null
      })),
      limit
    };
  }

  async listGracePeriodExpired(limit: number) {
    const agreements = await this.prismaService.loanAgreement.findMany({
      where: {
        status: LoanLifecycleStatus.grace_period,
        gracePeriodEndsAt: {
          lte: new Date()
        }
      },
      include: {
        customerAccount: {
          include: {
            customer: true
          }
        }
      },
      orderBy: {
        gracePeriodEndsAt: "asc"
      },
      take: limit
    });

    return {
      agreements: agreements.map((agreement) => ({
        loanAgreementId: agreement.id,
        customerEmail: agreement.customerAccount.customer.email,
        status: agreement.status,
        gracePeriodEndsAt: agreement.gracePeriodEndsAt?.toISOString() ?? null
      })),
      limit
    };
  }

  async escalateDefault(loanAgreementId: string, workerId: string, note?: string) {
    const agreement = await this.getLoanAgreementOrThrow(loanAgreementId);

    if (agreement.status === LoanLifecycleStatus.closed) {
      return {
        loanAgreementId,
        escalated: false,
        reason: "Loan is already closed."
      };
    }

    const shouldDefault =
      agreement.gracePeriodEndsAt !== null && agreement.gracePeriodEndsAt <= new Date();

    if (!shouldDefault) {
      return {
        loanAgreementId,
        escalated: false,
        reason: "Grace period has not yet expired."
      };
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const record = await transaction.loanAgreement.update({
        where: {
          id: loanAgreementId
        },
        data: {
          status: LoanLifecycleStatus.defaulted,
          defaultedAt: new Date(),
          delinquentAt: agreement.delinquentAt ?? new Date()
        }
      });

      await this.recordLoanEvent(transaction, {
        loanAgreementId,
        actorType: "worker",
        actorId: workerId,
        eventType: "defaulted",
        note: note ?? "Grace period expired and the loan defaulted."
      });

      return record;
    });

    return {
      loanAgreementId: updated.id,
      escalated: true,
      status: updated.status
    };
  }
}
