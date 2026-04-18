import { createHash } from "node:crypto";
import { ethers } from "ethers";

export type LiabilityLeafPayload = {
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

export type SolvencyReportPayload = {
  version: number;
  snapshotId: string;
  environment: string;
  chainId: number;
  snapshotStatus: string;
  evidenceFreshness: string;
  generatedAt: string;
  completedAt: string | null;
  totals: {
    totalLiabilityAmount: string;
    totalObservedReserveAmount: string;
    totalUsableReserveAmount: string;
    totalEncumberedReserveAmount: string;
    totalReserveDeltaAmount: string;
  };
  policyState: {
    status: string;
    pauseWithdrawalApprovals: boolean;
    pauseManagedWithdrawalExecution: boolean;
    pauseLoanFunding: boolean;
    pauseStakingWrites: boolean;
    requireManualOperatorReview: boolean;
    manualResumeRequired: boolean;
    reasonCode: string | null;
    reasonSummary: string | null;
  };
  assets: Array<{
    assetId: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
    assetType: string;
    snapshotStatus: string;
    evidenceFreshness: string;
    totalLiabilityAmount: string;
    usableReserveAmount: string;
    observedReserveAmount: string;
    encumberedReserveAmount: string;
    excludedReserveAmount: string;
    reserveDeltaAmount: string;
    reserveRatioBps: number | null;
    issueCount: number;
    liabilityMerkleRoot: string | null;
    liabilityLeafCount: number;
    liabilitySetChecksumSha256: string | null;
  }>;
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

export function buildSha256Checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashLiabilityLeaf(payload: LiabilityLeafPayload): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(stableStringify(payload)));
}

export function buildMerkleRoot(leafHashes: string[]): string | null {
  if (leafHashes.length === 0) {
    return null;
  }

  let level = [...leafHashes];

  while (level.length > 1) {
    const nextLevel: string[] = [];

    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]!;
      const right = level[index + 1] ?? left;
      nextLevel.push(hashMerklePair(left, right));
    }

    level = nextLevel;
  }

  return level[0] ?? null;
}

export function buildMerkleProof(leafHashes: string[], leafIndex: number): string[] {
  if (leafHashes.length === 0 || leafIndex < 0 || leafIndex >= leafHashes.length) {
    return [];
  }

  let index = leafIndex;
  let level = [...leafHashes];
  const proof: string[] = [];

  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(level[siblingIndex] ?? level[index]!);

    const nextLevel: string[] = [];
    for (let currentIndex = 0; currentIndex < level.length; currentIndex += 2) {
      const left = level[currentIndex]!;
      const right = level[currentIndex + 1] ?? left;
      nextLevel.push(hashMerklePair(left, right));
    }

    index = Math.floor(index / 2);
    level = nextLevel;
  }

  return proof;
}

export function buildSignedSolvencyReport(
  payload: SolvencyReportPayload,
  signerPrivateKey: string
): {
  canonicalPayloadText: string;
  reportHash: string;
  reportChecksumSha256: string;
  signature: string;
  signerAddress: string;
  signatureAlgorithm: string;
} {
  const canonicalPayloadText = stableStringify(payload);
  const reportHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(canonicalPayloadText)
  );
  const reportChecksumSha256 = buildSha256Checksum(canonicalPayloadText);
  const signer = new ethers.Wallet(signerPrivateKey);
  const signature = ethers.utils.joinSignature(
    signer._signingKey().signDigest(reportHash)
  );

  return {
    canonicalPayloadText,
    reportHash,
    reportChecksumSha256,
    signature,
    signerAddress: signer.address,
    signatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
  };
}

function hashMerklePair(left: string, right: string): string {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(["bytes32", "bytes32"], [left, right])
  );
}
