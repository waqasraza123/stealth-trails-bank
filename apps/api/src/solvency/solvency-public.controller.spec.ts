import { SolvencyPublicController } from "./solvency-public.controller";
import { SolvencyService } from "./solvency.service";

function createController() {
  const solvencyService = {
    listPublicReports: jest.fn(),
    getLatestPublicReport: jest.fn(),
    getPublicReportBySnapshotId: jest.fn()
  } as unknown as jest.Mocked<SolvencyService>;

  return {
    controller: new SolvencyPublicController(solvencyService),
    solvencyService
  };
}

describe("SolvencyPublicController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the public signed report index", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.listPublicReports as jest.Mock).mockResolvedValue({
      generatedAt: "2026-04-18T00:00:00.000Z",
      limit: 5,
      reports: []
    });

    const response = await controller.listReports({ limit: 5 });

    expect(solvencyService.listPublicReports).toHaveBeenCalledWith(5);
    expect(response.status).toBe("success");
  });

  it("returns the latest public signed report", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.getLatestPublicReport as jest.Mock).mockResolvedValue({
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
      }
    });

    const response = await controller.getLatestReport();

    expect(solvencyService.getLatestPublicReport).toHaveBeenCalled();
    expect(response.status).toBe("success");
  });
});
