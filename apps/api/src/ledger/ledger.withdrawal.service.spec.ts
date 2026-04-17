import { ConflictException } from "@nestjs/common";
import {
  LedgerAccountType,
  LedgerJournalType,
  LedgerPostingDirection,
  Prisma
} from "@prisma/client";
import { LedgerService } from "./ledger.service";

describe("LedgerService withdrawal helpers", () => {
  const service = new LedgerService();

  it("reserves withdrawal balance by moving available into pending", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "reservation_journal_1"
        })
      },
      ledgerAccount: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: "available_liability_account_1"
          })
          .mockResolvedValueOnce({
            id: "pending_liability_account_1"
          })
      },
      ledgerPosting: {
        createMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      customerAssetBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          availableBalance: new Prisma.Decimal("70"),
          pendingBalance: new Prisma.Decimal("30")
        })
      }
    } as any;

    const result = await service.reserveWithdrawalBalance(transaction, {
      transactionIntentId: "intent_1",
      customerAccountId: "account_1",
      assetId: "asset_1",
      chainId: 8453,
      amount: new Prisma.Decimal("30")
    });

    expect(transaction.customerAssetBalance.updateMany).toHaveBeenCalled();
    expect(result).toEqual({
      ledgerJournalId: "reservation_journal_1",
      debitLedgerAccountId: "available_liability_account_1",
      creditLedgerAccountId: "pending_liability_account_1",
      availableBalance: "70",
      pendingBalance: "30"
    });
  });

  it("releases withdrawal reservation back into available balance", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "release_journal_1"
        })
      },
      ledgerAccount: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: "available_liability_account_1"
          })
          .mockResolvedValueOnce({
            id: "pending_liability_account_1"
          })
      },
      ledgerPosting: {
        createMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      customerAssetBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          availableBalance: new Prisma.Decimal("100"),
          pendingBalance: new Prisma.Decimal("0")
        })
      }
    } as any;

    const result = await service.releaseWithdrawalReservation(transaction, {
      transactionIntentId: "intent_1",
      customerAccountId: "account_1",
      assetId: "asset_1",
      chainId: 8453,
      amount: new Prisma.Decimal("30")
    });

    expect(transaction.customerAssetBalance.updateMany).toHaveBeenCalled();
    expect(result).toEqual({
      ledgerJournalId: "release_journal_1",
      debitLedgerAccountId: "pending_liability_account_1",
      creditLedgerAccountId: "available_liability_account_1",
      availableBalance: "100",
      pendingBalance: "0"
    });
  });

  it("settles a confirmed withdrawal with ledger postings and pending balance reduction", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "journal_1"
        })
      },
      ledgerAccount: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: "outbound_account_1"
          })
          .mockResolvedValueOnce({
            id: "liability_account_1"
          })
      },
      customerAssetBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          availableBalance: new Prisma.Decimal("70"),
          pendingBalance: new Prisma.Decimal("0")
        })
      },
      ledgerPosting: {
        createMany: jest.fn().mockResolvedValue({ count: 2 })
      }
    } as any;

    const result = await service.settleConfirmedWithdrawal(transaction, {
      transactionIntentId: "intent_1",
      customerAccountId: "account_1",
      assetId: "asset_1",
      chainId: 8453,
      amount: new Prisma.Decimal("30")
    });

    expect(transaction.ledgerAccount.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          accountType: LedgerAccountType.asset_outbound_clearing
        })
      })
    );

    expect(transaction.ledgerAccount.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          accountType:
            LedgerAccountType.customer_asset_pending_withdrawal_liability
        })
      })
    );

    expect(transaction.ledgerJournal.create).toHaveBeenCalledWith({
      data: {
        transactionIntentId: "intent_1",
        journalType: LedgerJournalType.withdrawal_settlement,
        chainId: 8453,
        assetId: "asset_1"
      }
    });

    expect(transaction.ledgerPosting.createMany).toHaveBeenCalledWith({
      data: [
        {
          ledgerJournalId: "journal_1",
          ledgerAccountId: "liability_account_1",
          direction: LedgerPostingDirection.debit,
          amount: new Prisma.Decimal("30")
        },
        {
          ledgerJournalId: "journal_1",
          ledgerAccountId: "outbound_account_1",
          direction: LedgerPostingDirection.credit,
          amount: new Prisma.Decimal("30")
        }
      ]
    });

    expect(result).toEqual({
      ledgerJournalId: "journal_1",
      debitLedgerAccountId: "liability_account_1",
      creditLedgerAccountId: "outbound_account_1",
      availableBalance: "70",
      pendingBalance: "0"
    });
  });

  it("rejects settlement when reserved pending balance is missing", async () => {
    const transaction = {
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      ledgerAccount: {
        upsert: jest.fn()
      },
      customerAssetBalance: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    } as any;

    await expect(
      service.settleConfirmedWithdrawal(transaction, {
        transactionIntentId: "intent_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        chainId: 8453,
        amount: new Prisma.Decimal("30")
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
