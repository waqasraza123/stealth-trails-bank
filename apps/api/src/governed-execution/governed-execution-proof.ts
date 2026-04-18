import { ethers } from "ethers";
import {
  buildSha256Checksum,
  stableStringify
} from "../solvency/solvency-proof";

export type GovernedExecutionPackagePayload = {
  version: number;
  requestId: string;
  environment: string;
  chainId: number;
  executionType: string;
  targetType: string;
  targetId: string;
  loanAgreementId: string | null;
  stakingPoolGovernanceRequestId: string | null;
  contractAddress: string | null;
  contractMethod: string;
  walletAddress: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  } | null;
  loanAgreement: {
    id: string;
    status: string;
    contractLoanId: string | null;
    contractAddress: string | null;
  } | null;
  stakingPoolGovernanceRequest: {
    id: string;
    status: string;
    rewardRate: number;
    stakingPoolId: number | null;
  } | null;
  executionPayload: unknown;
  requestedByActorType: string;
  requestedByActorId: string;
  requestedByActorRole: string | null;
  requestedAt: string;
};

export function buildSignedGovernedExecutionPackage(
  payload: GovernedExecutionPackagePayload,
  signerPrivateKey: string
): {
  canonicalPayloadText: string;
  executionPackageHash: string;
  executionPackageChecksumSha256: string;
  executionPackageSignature: string;
  executionPackageSignerAddress: string;
  executionPackageSignatureAlgorithm: string;
} {
  const canonicalPayloadText = stableStringify(payload);
  const executionPackageHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(canonicalPayloadText)
  );
  const executionPackageChecksumSha256 = buildSha256Checksum(canonicalPayloadText);
  const signer = new ethers.Wallet(signerPrivateKey);
  const executionPackageSignature = ethers.utils.joinSignature(
    signer._signingKey().signDigest(executionPackageHash)
  );

  return {
    canonicalPayloadText,
    executionPackageHash,
    executionPackageChecksumSha256,
    executionPackageSignature,
    executionPackageSignerAddress: signer.address,
    executionPackageSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
  };
}

export function verifySignedGovernedExecutionPackage(input: {
  payload: GovernedExecutionPackagePayload;
  canonicalPayloadText: string;
  executionPackageHash: string;
  executionPackageChecksumSha256: string;
  executionPackageSignature: string;
  executionPackageSignerAddress: string;
  executionPackageSignatureAlgorithm: string;
}): {
  verified: boolean;
  verificationChecksumSha256: string;
  failureReason: string | null;
} {
  if (
    input.executionPackageSignatureAlgorithm !==
    "ethereum-secp256k1-keccak256-v1"
  ) {
    return {
      verified: false,
      verificationChecksumSha256: buildSha256Checksum(input.canonicalPayloadText),
      failureReason: "Unsupported governed execution package signature algorithm."
    };
  }

  const canonicalPayloadText = stableStringify(input.payload);
  const verificationChecksumSha256 = buildSha256Checksum(canonicalPayloadText);

  if (canonicalPayloadText !== input.canonicalPayloadText) {
    return {
      verified: false,
      verificationChecksumSha256,
      failureReason: "Canonical execution package payload text does not match the stored payload."
    };
  }

  if (verificationChecksumSha256 !== input.executionPackageChecksumSha256) {
    return {
      verified: false,
      verificationChecksumSha256,
      failureReason: "Governed execution package checksum does not match the canonical payload."
    };
  }

  const computedHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(canonicalPayloadText)
  );

  if (computedHash !== input.executionPackageHash) {
    return {
      verified: false,
      verificationChecksumSha256,
      failureReason: "Governed execution package hash does not match the canonical payload."
    };
  }

  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.utils.recoverAddress(
      computedHash,
      input.executionPackageSignature
    );
  } catch {
    return {
      verified: false,
      verificationChecksumSha256,
      failureReason: "Governed execution package signature could not be recovered."
    };
  }

  if (
    recoveredAddress.toLowerCase() !==
    input.executionPackageSignerAddress.toLowerCase()
  ) {
    return {
      verified: false,
      verificationChecksumSha256,
      failureReason: "Governed execution package signature does not recover the expected signer address."
    };
  }

  return {
    verified: true,
    verificationChecksumSha256,
    failureReason: null
  };
}
