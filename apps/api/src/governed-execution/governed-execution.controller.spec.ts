import { GovernedExecutionController } from "./governed-execution.controller";
import { GovernedExecutionService } from "./governed-execution.service";

function createController() {
  const governedExecutionService = {
    getWorkspace: jest.fn(),
    requestOverride: jest.fn(),
    approveOverride: jest.fn(),
    rejectOverride: jest.fn()
  } as unknown as GovernedExecutionService;

  return {
    controller: new GovernedExecutionController(governedExecutionService),
    governedExecutionService
  };
}

describe("GovernedExecutionController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the workspace for the current operator", async () => {
    const { controller, governedExecutionService } = createController();
    (governedExecutionService.getWorkspace as jest.Mock).mockResolvedValue({
      generatedAt: "2026-04-18T10:00:00.000Z"
    });

    const result = await controller.getWorkspace({
      internalOperator: {
        operatorId: "operator_1",
        operatorRole: "risk_manager"
      }
    });

    expect(governedExecutionService.getWorkspace).toHaveBeenCalledWith({
      operatorId: "operator_1",
      operatorRole: "risk_manager"
    });
    expect(result.status).toBe("success");
  });

  it("passes override requests through", async () => {
    const { controller, governedExecutionService } = createController();
    (governedExecutionService.requestOverride as jest.Mock).mockResolvedValue({
      request: {
        id: "override_1"
      }
    });

    await controller.requestOverride(
      {
        reasonCode: "incident_window",
        expiresInHours: 2,
        allowDirectLoanFunding: true
      },
      {
        internalOperator: {
          operatorId: "operator_1",
          operatorRole: "operations_admin"
        }
      }
    );

    expect(governedExecutionService.requestOverride).toHaveBeenCalledWith(
      {
        reasonCode: "incident_window",
        expiresInHours: 2,
        allowDirectLoanFunding: true
      },
      {
        operatorId: "operator_1",
        operatorRole: "operations_admin"
      }
    );
  });
});
