import { CustomerSolvencyController } from "./customer-solvency.controller";
import { SolvencyService } from "./solvency.service";

function createController() {
  const solvencyService = {
    getCustomerLiabilityInclusionProof: jest.fn()
  } as unknown as jest.Mocked<SolvencyService>;

  return {
    controller: new CustomerSolvencyController(solvencyService),
    solvencyService
  };
}

describe("CustomerSolvencyController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the authenticated customer's liability proof", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.getCustomerLiabilityInclusionProof as jest.Mock).mockResolvedValue({
      report: {
        id: "report_1",
        snapshotId: "snapshot_1",
        environment: "production",
        chainId: 8453,
        reportVersion: 1,
        reportHash: "0xreport",
        reportChecksumSha256: "checksum",
        canonicalPayload: {},
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
      customerAccountId: "account_1",
      proofs: []
    });

    const response = await controller.getMyLiabilityProof(
      {
        user: {
          id: "supabase_1"
        }
      },
      "snapshot_1"
    );

    expect(solvencyService.getCustomerLiabilityInclusionProof).toHaveBeenCalledWith(
      "supabase_1",
      "snapshot_1"
    );
    expect(response.status).toBe("success");
  });
});
