import {
  BlockchainTransactionStatus,
  PolicyDecision,
  TransactionIntentStatus
} from "@prisma/client";

export type DepositSettlementReconciliationState =
  | "waiting_for_confirmation"
  | "ready_for_confirm_replay"
  | "ready_for_settle_replay"
  | "healthy_settled"
  | "manual_review_required";

export type DepositSettlementReplayAction = "confirm" | "settle" | "none";

export type DepositSettlementReconciliationDecision = {
  state: DepositSettlementReconciliationState;
  replayAction: DepositSettlementReplayAction;
  reasonCode: string;
  reason: string;
  actionable: boolean;
};

type DepositSettlementReconciliationInput = {
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  latestBlockchainStatus: BlockchainTransactionStatus | null;
  hasLedgerJournal: boolean;
  hasSettlementProof: boolean;
};

export function classifyDepositSettlementReconciliation(
  input: DepositSettlementReconciliationInput
): DepositSettlementReconciliationDecision {
  if (input.policyDecision !== PolicyDecision.approved) {
    return {
      state: "manual_review_required",
      replayAction: "none",
      reasonCode: "unexpected_policy_decision",
      reason: "Policy decision is not approved.",
      actionable: false
    };
  }

  if (!input.latestBlockchainStatus) {
    return {
      state: "manual_review_required",
      replayAction: "none",
      reasonCode: "missing_blockchain_transaction",
      reason: "No blockchain transaction exists for this deposit intent.",
      actionable: false
    };
  }

  if (input.status === TransactionIntentStatus.broadcast) {
    if (input.latestBlockchainStatus === BlockchainTransactionStatus.broadcast) {
      return {
        state: "waiting_for_confirmation",
        replayAction: "none",
        reasonCode: "waiting_for_chain_confirmation",
        reason: "Deposit broadcast is still waiting for chain confirmation.",
        actionable: false
      };
    }

    if (input.latestBlockchainStatus === BlockchainTransactionStatus.confirmed) {
      if (input.hasLedgerJournal) {
        return {
          state: "manual_review_required",
          replayAction: "none",
          reasonCode: "ledger_exists_before_confirm_state",
          reason:
            "Ledger journal exists before the deposit intent reached confirmed state.",
          actionable: false
        };
      }

      return {
        state: "ready_for_confirm_replay",
        replayAction: "confirm",
        reasonCode: "broadcast_tx_already_confirmed",
        reason:
          "Blockchain transaction is already confirmed but the deposit intent is still broadcast.",
        actionable: true
      };
    }

    return {
      state: "manual_review_required",
      replayAction: "none",
      reasonCode: "unexpected_blockchain_status_for_broadcast",
      reason: "Broadcast deposit has an unexpected blockchain transaction status.",
      actionable: false
    };
  }

  if (input.status === TransactionIntentStatus.confirmed) {
    if (input.latestBlockchainStatus !== BlockchainTransactionStatus.confirmed) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "confirmed_without_confirmed_tx",
        reason:
          "Deposit intent is confirmed but the latest blockchain transaction is not confirmed.",
        actionable: false
      };
    }

    if (input.hasLedgerJournal) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "ledger_exists_before_settled_state",
        reason:
          "Ledger journal exists but the deposit intent did not reach settled state.",
        actionable: false
      };
    }

    if (input.hasSettlementProof) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "settlement_proof_exists_before_settled_state",
        reason:
          "Deposit settlement proof exists but the deposit intent did not reach settled state.",
        actionable: false
      };
    }

    if (input.settledAmount !== null) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "settled_amount_exists_before_settled_state",
        reason:
          "Settled amount exists but the deposit intent did not reach settled state.",
        actionable: false
      };
    }

    return {
      state: "ready_for_settle_replay",
      replayAction: "settle",
      reasonCode: "confirmed_without_ledger_settlement",
      reason:
        "Deposit intent is confirmed and safe to replay settlement because no ledger journal exists.",
      actionable: true
    };
  }

  if (input.status === TransactionIntentStatus.settled) {
    if (input.latestBlockchainStatus !== BlockchainTransactionStatus.confirmed) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "settled_without_confirmed_tx",
        reason:
          "Deposit intent is settled but the latest blockchain transaction is not confirmed.",
        actionable: false
      };
    }

    if (!input.hasLedgerJournal) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "missing_ledger_journal",
        reason: "Deposit intent is settled but the ledger journal is missing.",
        actionable: false
      };
    }

    if (!input.hasSettlementProof) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "missing_settlement_proof",
        reason:
          "Deposit intent is settled but the immutable settlement proof is missing.",
        actionable: false
      };
    }

    if (!input.settledAmount) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "missing_settled_amount",
        reason: "Deposit intent is settled but settledAmount is missing.",
        actionable: false
      };
    }

    if (input.settledAmount !== input.requestedAmount) {
      return {
        state: "manual_review_required",
        replayAction: "none",
        reasonCode: "settled_amount_mismatch",
        reason:
          "Deposit intent settledAmount does not match requestedAmount.",
        actionable: false
      };
    }

    return {
      state: "healthy_settled",
      replayAction: "none",
      reasonCode: "deposit_settlement_healthy",
      reason:
        "Deposit intent, blockchain transaction, and ledger settlement are aligned.",
      actionable: false
    };
  }

  return {
    state: "manual_review_required",
    replayAction: "none",
    reasonCode: "unsupported_intent_status",
    reason: "Deposit intent is in a status outside the reconciliation scope.",
    actionable: false
  };
}
