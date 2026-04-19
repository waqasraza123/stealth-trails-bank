import { UnauthorizedException } from "@nestjs/common";
import { InternalOperatorBearerGuard } from "./internal-operator-bearer.guard";

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

describe("InternalOperatorBearerGuard", () => {
  it("accepts a resolved bearer-backed operator identity", async () => {
    const guard = new InternalOperatorBearerGuard({
      resolveFromBearerToken: async () => ({
        operatorDbId: "operator_db_1",
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        operatorRoles: ["operations_admin", "risk_manager"],
        operatorSupabaseUserId: "supabase-operator-1",
        operatorEmail: "ops@example.com",
        authSource: "supabase_jwt",
        environment: "development",
        sessionCorrelationId: "session_1"
      })
    } as never);
    const { context, request } = createExecutionContext({
      authorization: "Bearer test-token"
    });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request).toEqual({
      headers: {
        authorization: "Bearer test-token"
      },
      internalOperator: {
        operatorDbId: "operator_db_1",
        operatorEmail: "ops@example.com",
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        operatorRoles: ["operations_admin", "risk_manager"],
        operatorSupabaseUserId: "supabase-operator-1",
        authSource: "supabase_jwt",
        environment: "development",
        sessionCorrelationId: "session_1"
      }
    });
  });

  it("rejects requests that present only legacy operator api key headers", async () => {
    const guard = new InternalOperatorBearerGuard({
      resolveFromBearerToken: async () => null
    } as never);
    const { context } = createExecutionContext({
      "x-operator-api-key": "test-operator-key",
      "x-operator-id": "ops_legacy",
      "x-operator-role": "risk_manager"
    });

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it("rejects requests with no resolved operator identity", async () => {
    const guard = new InternalOperatorBearerGuard({
      resolveFromBearerToken: async () => null
    } as never);
    const { context } = createExecutionContext({});

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException
    );
  });
});
