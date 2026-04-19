import {
  BlockchainTransactionStatus,
  PolicyDecision,
  TransactionIntentStatus
} from "@prisma/client";
import { DepositSettlementReconciliationService } from "./deposit-settlement-reconciliation.service";

function buildRecord() {
  return {
    id: "intent_1",
    customerAccountId: "account_1",
    destinationWalletId: "wallet_1",
    chainId: 8453,
    status: TransactionIntentStatus.settled,
    policyDecision: PolicyDecision.approved,
    requestedAmount: {
      toString: () => "25"
    },
    settledAmount: {
      toString: () => "20"
    },
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:10:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    destinationWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000fed"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      }
    },
    blockchainTransactions: [
      {
        id: "tx_1",
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        status: BlockchainTransactionStatus.confirmed,
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000fed",
        createdAt: new Date("2026-04-01T00:01:00.000Z"),
        updatedAt: new Date("2026-04-01T00:05:00.000Z"),
        confirmedAt: new Date("2026-04-01T00:05:00.000Z")
      }
    ],
    ledgerJournals: [
      {
        id: "journal_1",
        journalType: "deposit_settlement",
        postedAt: new Date("2026-04-01T00:10:00.000Z"),
        createdAt: new Date("2026-04-01T00:10:00.000Z")
      }
    ],
    depositSettlementProof: null
  };
}

describe("DepositSettlementReconciliationService review-case opening", () => {
  it("opens or reuses a review case for a manual-review-required deposit reconciliation state", async () => {
    const prismaService = {
      transactionIntent: {
        findFirst: jest.fn().mockResolvedValue(buildRecord())
      }
    } as any;

    const transactionIntentsService = {} as any;

    const reviewCasesService = {
      openOrReuseReviewCase: jest.fn().mockResolvedValue({
        reviewCase: {
          id: "review_case_1"
        },
        reviewCaseReused: false
      })
    } as any;

    const service = new DepositSettlementReconciliationService(
      prismaService,
      transactionIntentsService,
      reviewCasesService
    );

    const result = await service.openManualReviewCase("intent_1", "ops_1", {
      note: "Operator opened a manual review case."
    });

    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalled();
    expect(result.reviewCaseReused).toBe(false);
  });
});
