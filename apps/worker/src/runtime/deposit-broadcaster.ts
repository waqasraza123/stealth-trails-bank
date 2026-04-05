import { ethers } from "ethers";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  DepositBroadcastResult,
  ManagedDepositBroadcaster,
  ManagedExecutionFailure,
  WorkerIntentProjection
} from "./worker-types";

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)"
] as const;

type ManagedDepositTransferPlan =
  | {
      kind: "native";
      toAddress: string;
      value: ethers.BigNumber;
      txToAddress: string;
    }
  | {
      kind: "erc20";
      contractAddress: string;
      destinationAddress: string;
      amount: ethers.BigNumber;
      txToAddress: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class ManagedExecutionIntentError extends Error {
  readonly failure: ManagedExecutionFailure;

  constructor(failure: ManagedExecutionFailure) {
    super(failure.failureReason);
    this.name = "ManagedExecutionIntentError";
    this.failure = failure;
  }
}

export function buildManagedDepositTransferPlan(
  intent: WorkerIntentProjection
): ManagedDepositTransferPlan {
  const destinationWalletAddress = intent.destinationWalletAddress?.trim();

  if (!destinationWalletAddress) {
    throw new ManagedExecutionIntentError({
      failureCode: "missing_destination_wallet",
      failureReason:
        "Deposit intent is missing a destination wallet address and cannot be broadcast."
    });
  }

  const assetType = intent.asset.assetType;

  let amount: ethers.BigNumber;

  try {
    amount = ethers.utils.parseUnits(
      intent.requestedAmount,
      intent.asset.decimals
    );
  } catch {
    throw new ManagedExecutionIntentError({
      failureCode: "invalid_requested_amount",
      failureReason:
        "Deposit intent amount is invalid for the configured asset decimals.",
      toAddress: destinationWalletAddress
    });
  }

  if (assetType === "native") {
    return {
      kind: "native",
      toAddress: destinationWalletAddress,
      value: amount,
      txToAddress: destinationWalletAddress
    };
  }

  if (assetType === "erc20") {
    const contractAddress = intent.asset.contractAddress?.trim();

    if (!contractAddress) {
      throw new ManagedExecutionIntentError({
        failureCode: "missing_asset_contract_address",
        failureReason:
          "Deposit intent asset is ERC-20 but the contract address is missing.",
        toAddress: destinationWalletAddress
      });
    }

    return {
      kind: "erc20",
      contractAddress,
      destinationAddress: destinationWalletAddress,
      amount,
      txToAddress: contractAddress
    };
  }

  throw new ManagedExecutionIntentError({
    failureCode: "unsupported_asset_type",
    failureReason: `Deposit intent asset type '${assetType}' is not supported by the managed worker broadcaster.`,
    toAddress: destinationWalletAddress
  });
}

function describeBroadcastError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (isRecord(error)) {
    const message = error["message"];

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Unknown broadcast error.";
}

export function createManagedDepositBroadcaster(
  runtime: WorkerRuntime
): ManagedDepositBroadcaster {
  if (runtime.executionMode !== "managed") {
    throw new Error(
      "Managed deposit broadcaster can only be created when WORKER_EXECUTION_MODE=managed."
    );
  }

  if (!runtime.rpcUrl) {
    throw new Error("RPC_URL is required for managed deposit broadcasting.");
  }

  if (!runtime.depositSignerPrivateKey) {
    throw new Error(
      "WORKER_DEPOSIT_SIGNER_PRIVATE_KEY is required for managed deposit broadcasting."
    );
  }

  const provider = new ethers.providers.JsonRpcProvider(runtime.rpcUrl);
  const signer = new ethers.Wallet(runtime.depositSignerPrivateKey, provider);
  const signerAddress = signer.address;

  return {
    signerAddress,
    async broadcast(intent: WorkerIntentProjection): Promise<DepositBroadcastResult> {
      const plan = buildManagedDepositTransferPlan(intent);

      try {
        if (plan.kind === "native") {
          const response = await signer.sendTransaction({
            to: plan.toAddress,
            value: plan.value
          });

          return {
            txHash: response.hash,
            fromAddress: signerAddress,
            toAddress: plan.txToAddress
          };
        }

        const contract = new ethers.Contract(
          plan.contractAddress,
          ERC20_TRANSFER_ABI,
          signer
        );
        const response = await contract.transfer(
          plan.destinationAddress,
          plan.amount
        );

        return {
          txHash: response.hash,
          fromAddress: signerAddress,
          toAddress: plan.txToAddress
        };
      } catch (error) {
        throw new Error(describeBroadcastError(error));
      }
    }
  };
}
