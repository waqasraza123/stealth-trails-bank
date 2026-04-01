import { ConflictException, Injectable } from "@nestjs/common";
import {
  LedgerAccountType,
  LedgerJournalType,
  LedgerPostingDirection,
  Prisma
} from "@prisma/client";

type SettleConfirmedDepositParams = {
  transactionIntentId: string;
  customerAccountId: string;
  assetId: string;
  chainId: number;
  amount: Prisma.Decimal;
};

type SettledDepositLedgerResult = {
  ledgerJournalId: string;
  debitLedgerAccountId: string;
  creditLedgerAccountId: string;
  availableBalance: string;
};

@Injectable()
export class LedgerService {
  private buildInboundClearingLedgerKey(chainId: number, assetId: string): string {
    return `asset_inbound_clearing:${chainId}:${assetId}`;
  }

  private buildCustomerLiabilityLedgerKey(
    customerAccountId: string,
    assetId: string
  ): string {
    return `customer_asset_liability:${customerAccountId}:${assetId}`;
  }

  async settleConfirmedDeposit(
    transaction: Prisma.TransactionClient,
    params: SettleConfirmedDepositParams
  ): Promise<SettledDepositLedgerResult> {
    const existingJournal = await transaction.ledgerJournal.findUnique({
      where: {
        transactionIntentId: params.transactionIntentId
      },
      select: {
        id: true
      }
    });

    if (existingJournal) {
      throw new ConflictException(
        "Ledger settlement already exists for this transaction intent."
      );
    }

    const inboundClearingAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildInboundClearingLedgerKey(
          params.chainId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildInboundClearingLedgerKey(
          params.chainId,
          params.assetId
        ),
        accountType: LedgerAccountType.asset_inbound_clearing,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    const customerLiabilityAccount = await transaction.ledgerAccount.upsert({
      where: {
        ledgerKey: this.buildCustomerLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        )
      },
      update: {},
      create: {
        ledgerKey: this.buildCustomerLiabilityLedgerKey(
          params.customerAccountId,
          params.assetId
        ),
        accountType: LedgerAccountType.customer_asset_liability,
        chainId: params.chainId,
        assetId: params.assetId,
        customerAccountId: params.customerAccountId
      }
    });

    const ledgerJournal = await transaction.ledgerJournal.create({
      data: {
        transactionIntentId: params.transactionIntentId,
        journalType: LedgerJournalType.deposit_settlement,
        chainId: params.chainId,
        assetId: params.assetId
      }
    });

    await transaction.ledgerPosting.createMany({
      data: [
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: inboundClearingAccount.id,
          direction: LedgerPostingDirection.debit,
          amount: params.amount
        },
        {
          ledgerJournalId: ledgerJournal.id,
          ledgerAccountId: customerLiabilityAccount.id,
          direction: LedgerPostingDirection.credit,
          amount: params.amount
        }
      ]
    });

    const customerAssetBalance = await transaction.customerAssetBalance.upsert({
      where: {
        customerAccountId_assetId: {
          customerAccountId: params.customerAccountId,
          assetId: params.assetId
        }
      },
      create: {
        customerAccountId: params.customerAccountId,
        assetId: params.assetId,
        availableBalance: params.amount,
        pendingBalance: new Prisma.Decimal(0)
      },
      update: {
        availableBalance: {
          increment: params.amount
        }
      }
    });

    return {
      ledgerJournalId: ledgerJournal.id,
      debitLedgerAccountId: inboundClearingAccount.id,
      creditLedgerAccountId: customerLiabilityAccount.id,
      availableBalance: customerAssetBalance.availableBalance.toString()
    };
  }
}
