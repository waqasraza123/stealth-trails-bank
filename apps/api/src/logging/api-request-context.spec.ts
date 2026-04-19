import {
  REQUEST_ID_HEADER,
  assignRequestContext,
  type ApiNextFunction,
  type ApiResponseLike,
  normalizeHeaderValue,
  resolveRequestActor,
  resolveRequestId,
  type ApiRequestContext
} from "./api-request-context";

describe("api request context", () => {
  it("normalizes header values", () => {
    expect(normalizeHeaderValue("  abc  ")).toBe("abc");
    expect(normalizeHeaderValue(["  abc  "])).toBe("abc");
    expect(normalizeHeaderValue(undefined)).toBeNull();
  });

  it("reuses a valid incoming request id and replaces an invalid one", () => {
    expect(resolveRequestId("request-id_1234")).toBe("request-id_1234");
    expect(resolveRequestId("bad value with spaces")).not.toBe(
      "bad value with spaces"
    );
  });

  it("assigns request id context and mirrors it in the response header", () => {
    const request = {
      headers: {
        [REQUEST_ID_HEADER]: "request-id_1234"
      }
    } as ApiRequestContext;
    const response = {
      setHeader: jest.fn()
    } as ApiResponseLike;
    const next = jest.fn() as ApiNextFunction;

    assignRequestContext(request, response, next);

    expect(request.requestId).toBe("request-id_1234");
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      "request-id_1234"
    );
    expect(next).toHaveBeenCalled();
  });

  it("resolves actor context for operator, worker, customer, and anonymous requests", () => {
    expect(
      resolveRequestActor({
        internalOperator: {
          operatorId: "ops_1",
          operatorRole: "operations_admin"
        }
      } as ApiRequestContext)
    ).toEqual({
      actorType: "operator",
      actorId: "ops_1",
      actorRole: "operations_admin",
      authSource: null,
      environment: null,
      sessionCorrelationId: null
    });

    expect(
      resolveRequestActor({
        internalWorker: {
          workerId: "worker_1"
        }
      } as ApiRequestContext)
    ).toEqual({
      actorType: "worker",
      actorId: "worker_1",
      actorRole: null,
      authSource: null,
      environment: null,
      sessionCorrelationId: null
    });

    expect(
      resolveRequestActor({
        user: {
          id: "customer_1",
          email: "customer@example.com"
        }
      } as ApiRequestContext)
    ).toEqual({
      actorType: "customer",
      actorId: "customer_1",
      actorRole: null,
      authSource: null,
      environment: null,
      sessionCorrelationId: null
    });

    expect(resolveRequestActor({} as ApiRequestContext)).toEqual({
      actorType: "anonymous",
      actorId: null,
      actorRole: null,
      authSource: null,
      environment: null,
      sessionCorrelationId: null
    });
  });
});
