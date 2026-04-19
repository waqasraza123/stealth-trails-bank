import {
  createCorsOriginDelegate,
  loadApiBootstrapRuntime
} from "./api-server.util";

describe("api server bootstrap runtime", () => {
  it("uses local development defaults when no server env is configured", () => {
    const runtime = loadApiBootstrapRuntime({});

    expect(runtime.environment).toBe("development");
    expect(runtime.port).toBe(9001);
    expect(runtime.corsAllowedOrigins).toEqual(
      expect.arrayContaining([
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ])
    );
  });

  it("uses explicit production port and cors origins", () => {
    const runtime = loadApiBootstrapRuntime({
      NODE_ENV: "production",
      API_PORT: "9100",
      CORS_ALLOWED_ORIGINS:
        "https://bank.example.com, https://ops.example.com/"
    });

    expect(runtime.environment).toBe("production");
    expect(runtime.port).toBe(9100);
    expect(runtime.corsAllowedOrigins).toEqual([
      "https://bank.example.com",
      "https://ops.example.com"
    ]);
  });

  it("fails closed when production cors origins are missing", () => {
    expect(() =>
      loadApiBootstrapRuntime({
        NODE_ENV: "production"
      })
    ).toThrow("CORS_ALLOWED_ORIGINS is required when NODE_ENV=production.");
  });

  it("rejects wildcard cors origin configuration", () => {
    expect(() =>
      loadApiBootstrapRuntime({
        CORS_ALLOWED_ORIGINS: "*"
      })
    ).toThrow("Wildcard '*' is not allowed.");
  });
});

describe("createCorsOriginDelegate", () => {
  it("allows configured origins and non-browser requests", () => {
    const originDelegate = createCorsOriginDelegate([
      "https://bank.example.com"
    ]);
    const decisions: boolean[] = [];

    originDelegate(undefined, (_error, allow) => {
      decisions.push(Boolean(allow));
    });
    originDelegate("https://bank.example.com", (_error, allow) => {
      decisions.push(Boolean(allow));
    });
    originDelegate("https://evil.example.com", (_error, allow) => {
      decisions.push(Boolean(allow));
    });

    expect(decisions).toEqual([true, true, false]);
  });
});
