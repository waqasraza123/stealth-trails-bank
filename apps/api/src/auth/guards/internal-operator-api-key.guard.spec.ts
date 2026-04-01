import { UnauthorizedException } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "./internal-operator-api-key.guard";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

function createExecutionContext(headers: Record<string, string | undefined>) {
  const request = {
    headers
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request
    })
  };

  return {
    context,
    request
  };
}

describe("InternalOperatorApiKeyGuard", () => {
  it("accepts a valid operator api key and operator id", () => {
    const guard = new InternalOperatorApiKeyGuard();
    const { context, request } = createExecutionContext({
      "x-operator-api-key": "test-operator-key",
      "x-operator-id": "ops_1"
    });

    expect(guard.canActivate(context as never)).toBe(true);
    expect(request).toEqual({
      headers: {
        "x-operator-api-key": "test-operator-key",
        "x-operator-id": "ops_1"
      },
      internalOperator: {
        operatorId: "ops_1"
      }
    });
  });

  it("rejects a missing operator api key", () => {
    const guard = new InternalOperatorApiKeyGuard();
    const { context } = createExecutionContext({
      "x-operator-id": "ops_1"
    });

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });

  it("rejects an invalid operator api key", () => {
    const guard = new InternalOperatorApiKeyGuard();
    const { context } = createExecutionContext({
      "x-operator-api-key": "wrong-key",
      "x-operator-id": "ops_1"
    });

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });

  it("rejects a missing operator id", () => {
    const guard = new InternalOperatorApiKeyGuard();
    const { context } = createExecutionContext({
      "x-operator-api-key": "test-operator-key"
    });

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException
    );
  });
});
