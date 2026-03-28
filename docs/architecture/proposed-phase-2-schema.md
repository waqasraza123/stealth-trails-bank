# Proposed Phase 2 Schema

## Purpose

This document provides a proposed Prisma facing schema plan for the next production redesign phase without changing the live schema yet.

This is a planning artifact, not a migration.

## Planning Rules

- do not copy this into the live schema without review
- use this as the basis for the first real schema redesign commit
- prefer additive migration sequencing over destructive replacement
- do not delete current tables until compatibility and data migration strategy are clear

## Proposed Enums

    enum AccountLifecycleStatus {
      registered
      email_verified
      review_required
      active
      restricted
      frozen
      closed
    }

    enum WalletKind {
      embedded
      external
      treasury
      operational
      contract
    }

    enum WalletCustodyType {
      platform_managed
      customer_external
      multisig_controlled
      contract_controlled
    }

    enum WalletStatus {
      pending
      active
      restricted
      archived
    }

    enum AssetType {
      native
      erc20
    }

    enum AssetStatus {
      active
      disabled
    }

    enum VaultProductStatus {
      draft
      active
      paused
      closed
    }

    enum TransactionIntentType {
      deposit
      withdrawal
      vault_subscription
      vault_redemption
      treasury_transfer
      adjustment
    }

    enum TransactionIntentStatus {
      requested
      review_required
      approved
      queued
      broadcast
      confirmed
      settled
      failed
      cancelled
      manually_resolved
    }

    enum PolicyDecision {
      pending
      approved
      denied
      review_required
    }

    enum BlockchainTransactionStatus {
      created
      signed
      broadcast
      confirmed
      failed
      replaced
      dropped
    }

    enum JournalAccountCategory {
      customer_asset
      customer_pending
      customer_reserved
      vault_pool
      treasury_hot
      treasury_reserve
      fees_revenue
      settlement_transit
      adjustment
    }

    enum ReviewCaseStatus {
      open
      in_progress
      resolved
      dismissed
    }

    enum ReviewCaseType {
      account_review
      withdrawal_review
      reconciliation_review
      manual_intervention
    }

## Proposed Models

### Customer

    model Customer {
      id             String            @id @default(cuid())
      supabaseUserId String            @unique
      email          String            @unique
      firstName      String?
      lastName       String?
      createdAt      DateTime          @default(now())
      updatedAt      DateTime          @updatedAt
      accounts       CustomerAccount[]
      auditEvents    AuditEvent[]
      reviewCases    ReviewCase[]
    }

### CustomerAccount

    model CustomerAccount {
      id                 String                 @id @default(cuid())
      customerId         String
      customer           Customer               @relation(fields: [customerId], references: [id])
      status             AccountLifecycleStatus
      displayCurrency    String?
      activatedAt        DateTime?
      restrictedAt       DateTime?
      frozenAt           DateTime?
      closedAt           DateTime?
      createdAt          DateTime               @default(now())
      updatedAt          DateTime               @updatedAt
      wallets            Wallet[]
      transactionIntents TransactionIntent[]
      reviewCases        ReviewCase[]
      journalAccounts    JournalAccount[]

      @@index([customerId])
      @@index([status])
    }

### Wallet

    model Wallet {
      id                 String              @id @default(cuid())
      customerAccountId  String?
      customerAccount    CustomerAccount?    @relation(fields: [customerAccountId], references: [id])
      chainId            Int
      address            String
      kind               WalletKind
      custodyType        WalletCustodyType
      status             WalletStatus
      createdAt          DateTime            @default(now())
      updatedAt          DateTime            @updatedAt
      sourceIntents      TransactionIntent[] @relation("SourceWallet")
      destinationIntents TransactionIntent[] @relation("DestinationWallet")

      @@unique([chainId, address])
      @@index([customerAccountId])
      @@index([kind, custodyType])
    }

### Asset

    model Asset {
      id                 String              @id @default(cuid())
      chainId            Int
      symbol             String
      displayName        String
      decimals           Int
      assetType          AssetType
      contractAddress    String?
      status             AssetStatus
      createdAt          DateTime            @default(now())
      updatedAt          DateTime            @updatedAt
      vaultProducts      VaultProduct[]
      transactionIntents TransactionIntent[]
      journalAccounts    JournalAccount[]

      @@unique([chainId, symbol])
      @@unique([chainId, contractAddress])
    }

### VaultProduct

    model VaultProduct {
      id                 String              @id @default(cuid())
      code               String              @unique
      displayName        String
      chainId            Int
      assetId            String
      asset              Asset               @relation(fields: [assetId], references: [id])
      contractAddress    String
      status             VaultProductStatus
      createdAt          DateTime            @default(now())
      updatedAt          DateTime            @updatedAt
      transactionIntents TransactionIntent[]

      @@index([assetId])
      @@index([status])
    }

### TransactionIntent

    model TransactionIntent {
      id                     String                      @id @default(cuid())
      customerAccountId      String?
      customerAccount        CustomerAccount?            @relation(fields: [customerAccountId], references: [id])
      vaultProductId         String?
      vaultProduct           VaultProduct?               @relation(fields: [vaultProductId], references: [id])
      assetId                String
      asset                  Asset                       @relation(fields: [assetId], references: [id])
      sourceWalletId         String?
      sourceWallet           Wallet?                     @relation("SourceWallet", fields: [sourceWalletId], references: [id])
      destinationWalletId    String?
      destinationWallet      Wallet?                     @relation("DestinationWallet", fields: [destinationWalletId], references: [id])
      intentType             TransactionIntentType
      status                 TransactionIntentStatus
      policyDecision         PolicyDecision
      requestedAmount        Decimal                     @db.Decimal(36, 18)
      settledAmount          Decimal?                    @db.Decimal(36, 18)
      idempotencyKey         String                      @unique
      failureCode            String?
      failureReason          String?
      createdAt              DateTime                    @default(now())
      updatedAt              DateTime                    @updatedAt
      blockchainTransactions BlockchainTransaction[]
      journalBatches         JournalBatch[]
      reviewCases            ReviewCase[]

      @@index([customerAccountId])
      @@index([assetId])
      @@index([vaultProductId])
      @@index([intentType, status])
    }

### BlockchainTransaction

    model BlockchainTransaction {
      id                  String                    @id @default(cuid())
      transactionIntentId String
      transactionIntent   TransactionIntent         @relation(fields: [transactionIntentId], references: [id])
      chainId             Int
      txHash              String?                   @unique
      nonce               Int?
      status              BlockchainTransactionStatus
      fromAddress         String?
      toAddress           String?
      createdAt           DateTime                  @default(now())
      updatedAt           DateTime                  @updatedAt
      confirmedAt         DateTime?

      @@index([transactionIntentId])
      @@index([chainId, status])
    }

### JournalAccount

    model JournalAccount {
      id                String          @id @default(cuid())
      customerAccountId String?
      customerAccount   CustomerAccount? @relation(fields: [customerAccountId], references: [id])
      assetId           String?
      asset             Asset?          @relation(fields: [assetId], references: [id])
      code              String          @unique
      category          JournalAccountCategory
      createdAt         DateTime        @default(now())
      updatedAt         DateTime        @updatedAt
      debitEntries      JournalEntry[]  @relation("DebitAccount")
      creditEntries     JournalEntry[]  @relation("CreditAccount")

      @@index([customerAccountId])
      @@index([assetId])
      @@index([category])
    }

### JournalBatch

    model JournalBatch {
      id                  String             @id @default(cuid())
      transactionIntentId String?
      transactionIntent   TransactionIntent? @relation(fields: [transactionIntentId], references: [id])
      referenceCode       String             @unique
      createdAt           DateTime           @default(now())
      entries             JournalEntry[]

      @@index([transactionIntentId])
    }

### JournalEntry

    model JournalEntry {
      id              String         @id @default(cuid())
      journalBatchId  String
      journalBatch    JournalBatch   @relation(fields: [journalBatchId], references: [id])
      debitAccountId  String
      debitAccount    JournalAccount @relation("DebitAccount", fields: [debitAccountId], references: [id])
      creditAccountId String
      creditAccount   JournalAccount @relation("CreditAccount", fields: [creditAccountId], references: [id])
      assetId         String
      asset           Asset          @relation(fields: [assetId], references: [id])
      amount          Decimal        @db.Decimal(36, 18)
      createdAt       DateTime       @default(now())

      @@index([journalBatchId])
      @@index([debitAccountId])
      @@index([creditAccountId])
      @@index([assetId])
    }

### ReviewCase

    model ReviewCase {
      id                  String             @id @default(cuid())
      customerId          String?
      customer            Customer?          @relation(fields: [customerId], references: [id])
      customerAccountId   String?
      customerAccount     CustomerAccount?   @relation(fields: [customerAccountId], references: [id])
      transactionIntentId String?
      transactionIntent   TransactionIntent? @relation(fields: [transactionIntentId], references: [id])
      type                ReviewCaseType
      status              ReviewCaseStatus
      reasonCode          String?
      notes               String?
      createdAt           DateTime           @default(now())
      updatedAt           DateTime           @updatedAt

      @@index([customerId])
      @@index([customerAccountId])
      @@index([transactionIntentId])
      @@index([type, status])
    }

### AuditEvent

    model AuditEvent {
      id         String    @id @default(cuid())
      customerId String?
      customer   Customer? @relation(fields: [customerId], references: [id])
      actorType  String
      actorId    String?
      action     String
      targetType String
      targetId   String?
      metadata   Json?
      createdAt  DateTime  @default(now())

      @@index([customerId])
      @@index([actorType, actorId])
      @@index([targetType, targetId])
    }

## Mapping From Current Schema To Proposed Shape

### Current `User`

Current `User` should later split into:
- `Customer`
- `CustomerAccount`

### Current `StakingPool`

Current `StakingPool` should later become part of:
- `VaultProduct`
- separate product accounting and intent records

### Current `PoolDeposit`

Current `PoolDeposit` is not rich enough as a production transaction model.
It should later map into:
- `TransactionIntent`
- `BlockchainTransaction`
- `JournalBatch`
- `JournalEntry`

### Current `PoolWithdrawal`

Current `PoolWithdrawal` should later map into the same richer intent and ledger flow.

## Planning Notes

This proposed schema is intentionally richer than the live prototype.

That is expected because the target product needs:
- async blockchain orchestration
- ledger backed balances
- operator review
- restriction states
- auditability

## This Document Does Not Authorize

This document does not authorize:
- changing the live Prisma schema yet
- deleting current models
- moving migrations yet
- implementing every proposed model in one schema commit
