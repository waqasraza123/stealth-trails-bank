import { ConflictException } from "@nestjs/common";
import { LedgerPostingDirection } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { LedgerService } from "./ledger.service";

function createTransactionClient() {
  return {
    ledgerJournal: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    ledgerAccount: {
      upsert: jest.fn()
    },
    ledgerPosting: {
      createMany: jest.fn()
    },
    customerAssetBalance: {
      upsert: jest.fn()
    }
  };
}

describe("LedgerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts a confirmed deposit into ledger and balance read model", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue(null);
    transaction.ledgerAccount.upsert
      .mockResolvedValueOnce({
        id: "ledger_account_inbound"
      })
      .mockResolvedValueOnce({
        id: "ledger_account_customer"
      });
    transaction.ledgerJournal.create.mockResolvedValue({
      id: "ledger_journal_1"
    });
    transaction.ledgerPosting.createMany.mockResolvedValue({
      count: 2
    });
    transaction.customerAssetBalance.upsert.mockResolvedValue({
      availableBalance: new Prisma.Decimal("5.25")
    });

    const result = await service.settleConfirmedDeposit(transaction as never, {
      transactionIntentId: "intent_1",
      customerAccountId: "account_1",
      assetId: "asset_1",
      chainId: 8453,
      amount: new Prisma.Decimal("5.25")
    });

    expect(result.ledgerJournalId).toBe("ledger_journal_1");
    expect(result.availableBalance).toBe("5.25");
    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "ledger_journal_1",
          ledgerAccountId: "ledger_account_inbound",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("5.25")
        },
        {
          ledgerJournalId: "ledger_journal_1",
          ledgerAccountId: "ledger_account_customer",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("5.25")
        }
      ]
    });
  });

  it("rejects duplicate settlement journal creation", async () => {
    const service = new LedgerService();
    const transaction = createTransactionClient();

    transaction.ledgerJournal.findUnique.mockResolvedValue({
      id: "ledger_journal_1"
    });

    await expect(
      service.settleConfirmedDeposit(transaction as never, {
        transactionIntentId: "intent_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("5.25")
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
