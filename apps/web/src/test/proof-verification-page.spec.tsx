import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import ProofVerification from "@/pages/ProofVerification";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";
import { hashLiabilityLeaf, stableStringify } from "@/lib/solvency-proof";

vi.mock("axios");

const mockAxios = vi.mocked(axios, true);

describe("proof verification page", () => {
  beforeEach(() => {
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000"
      }
    });

    const payload = {
      version: 1,
      snapshotId: "snapshot_1",
      assetId: "asset_eth",
      assetSymbol: "ETH",
      customerAccountId: "customer_account_1",
      leafIndex: 0,
      availableLiabilityAmount: "10",
      reservedLiabilityAmount: "0",
      pendingCreditAmount: "0",
      totalLiabilityAmount: "10"
    } as const;
    const leafHash = hashLiabilityLeaf(payload);

    mockAxios.get.mockResolvedValue({
      data: {
        status: "success",
        message: "ok",
        data: {
          report: {
            id: "report_1",
            snapshotId: "snapshot_1",
            environment: "production",
            chainId: 8453,
            reportVersion: 1,
            reportHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            reportChecksumSha256: "checksum",
            canonicalPayload: {
              verificationText: stableStringify(payload)
            },
            canonicalPayloadText: "{}",
            signature: "0xsig",
            signatureAlgorithm: "ethereum-secp256k1-keccak256-v1",
            signerAddress: "0x0000000000000000000000000000000000000abc",
            publishedAt: "2026-04-18T00:00:00.000Z"
          },
          snapshot: {
            id: "snapshot_1",
            environment: "production",
            status: "healthy",
            evidenceFreshness: "fresh",
            generatedAt: "2026-04-18T00:00:00.000Z",
            completedAt: "2026-04-18T00:00:01.000Z",
            totalLiabilityAmount: "10",
            totalObservedReserveAmount: "12",
            totalUsableReserveAmount: "12",
            totalEncumberedReserveAmount: "0",
            totalReserveDeltaAmount: "2",
            assetCount: 1,
            issueCount: 0,
            policyActionsTriggered: false,
            failureCode: null,
            failureMessage: null,
            report: null
          },
          customerAccountId: "customer_account_1",
          proofs: [
            {
              asset: {
                id: "asset_eth",
                symbol: "ETH",
                displayName: "Ether",
                decimals: 18,
                chainId: 8453,
                assetType: "native"
              },
              leafIndex: 0,
              leafHash,
              rootHash: leafHash,
              proof: [],
              payload
            }
          ]
        }
      }
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useUserStore.setState({ token: null, user: null });
  });

  it("loads the customer liability proof and verifies the published root locally", async () => {
    renderWithRouter(<ProofVerification />, {
      initialEntries: ["/proofs/me"]
    });

    expect(
      await screen.findByRole("heading", {
        name: /verify your liabilities were included in the solvency snapshot/i
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/leaf and merkle root verified locally/i)).toBeInTheDocument();
      expect(screen.getAllByText(/merkle proof path/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/0x1234567890abcdef/i)).toBeInTheDocument();
    });
  });
});
