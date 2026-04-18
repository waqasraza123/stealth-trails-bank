import { ethers } from "ethers";

type LiabilityLeafPayload = {
  version: number;
  snapshotId: string;
  assetId: string;
  assetSymbol: string;
  customerAccountId: string;
  leafIndex: number;
  availableLiabilityAmount: string;
  reservedLiabilityAmount: string;
  pendingCreditAmount: string;
  totalLiabilityAmount: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashLiabilityLeaf(payload: LiabilityLeafPayload): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(stableStringify(payload)));
}

export function verifyLiabilityProof(input: {
  payload: LiabilityLeafPayload;
  leafHash: string;
  rootHash: string;
  proof: string[];
  leafIndex: number;
}): {
  computedLeafHash: string;
  computedRootHash: string;
  isLeafHashValid: boolean;
  isRootValid: boolean;
} {
  const computedLeafHash = hashLiabilityLeaf(input.payload);
  let currentHash = computedLeafHash;
  let currentIndex = input.leafIndex;

  for (const siblingHash of input.proof) {
    if (currentIndex % 2 === 0) {
      currentHash = hashMerklePair(currentHash, siblingHash);
    } else {
      currentHash = hashMerklePair(siblingHash, currentHash);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    computedLeafHash,
    computedRootHash: currentHash,
    isLeafHashValid:
      computedLeafHash.toLowerCase() === input.leafHash.toLowerCase(),
    isRootValid: currentHash.toLowerCase() === input.rootHash.toLowerCase()
  };
}

function hashMerklePair(left: string, right: string): string {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(["bytes32", "bytes32"], [left, right])
  );
}
