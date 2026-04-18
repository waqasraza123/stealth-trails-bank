import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import TrustCenter from "@/pages/TrustCenter";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("axios");

const mockAxios = vi.mocked(axios, true);

describe("trust center page", () => {
  beforeEach(() => {
    mockAxios.get.mockResolvedValue({
      data: {
        status: "success",
        message: "ok",
        data: {
          generatedAt: "2026-04-18T00:00:00.000Z",
          limit: 12,
          reports: [
            {
              report: {
                id: "report_1",
                snapshotId: "snapshot_1",
                environment: "production",
                chainId: 8453,
                reportVersion: 1,
                reportHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                reportChecksumSha256: "checksum",
                canonicalPayload: {
                  policyState: {
                    status: "normal",
                    manualResumeRequired: false,
                    reasonCode: null
                  },
                  assets: [
                    {
                      assetId: "asset_eth",
                      symbol: "ETH",
                      displayName: "Ether",
                      snapshotStatus: "healthy",
                      totalLiabilityAmount: "10",
                      usableReserveAmount: "12",
                      reserveDeltaAmount: "2",
                      liabilityMerkleRoot:
                        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                      liabilityLeafCount: 1
                    }
                  ]
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
              }
            }
          ]
        }
      }
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the public report index and selected asset roots", async () => {
    renderWithRouter(<TrustCenter />, {
      initialEntries: ["/trust/solvency"]
    });

    expect(
      await screen.findByRole("heading", {
        name: /signed solvency reports and proof-of-liabilities/i
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/public report index/i)).toBeInTheDocument();
      expect(screen.getByText(/ether \(eth\)/i)).toBeInTheDocument();
      expect(screen.getByText(/0xaaaaaaaa/i)).toBeInTheDocument();
    });
  });
});
