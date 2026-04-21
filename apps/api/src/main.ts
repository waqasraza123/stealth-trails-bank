import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadApiBootstrapRuntime } from "./bootstrap/api-server.util";
import { ApiRequestLoggingInterceptor } from "./logging/api-request-logging.interceptor";
import { assignRequestContext } from "./logging/api-request-context";
import { ApiRequestMetricsService } from "./logging/api-request-metrics.service";
import { writeStructuredApiLog } from "./logging/structured-api-logger";

type NodeRequest = {
  url?: string;
};

type NodeResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

type RequestHandler = (req: NodeRequest, res: NodeResponse) => void;

async function createApiApp() {
  const { port, corsOriginDelegate } = loadApiBootstrapRuntime();
  const app = await NestFactory.create(AppModule);
  const httpAdapterInstance = app.getHttpAdapter().getInstance?.();

  if (
    httpAdapterInstance &&
    typeof httpAdapterInstance.disable === "function"
  ) {
    httpAdapterInstance.disable("x-powered-by");
  }

  app.enableShutdownHooks();
  app.use(assignRequestContext);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalInterceptors(
    new ApiRequestLoggingInterceptor(app.get(ApiRequestMetricsService))
  );

  app.enableCors({
    origin: corsOriginDelegate,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
      "X-Stb-Client-Platform",
      "X-Internal-Operator-Api-Key",
      "X-Internal-Worker-Api-Key"
    ],
    exposedHeaders: ["X-Request-Id"],
    optionsSuccessStatus: 204,
    maxAge: 86400
  });

  return {
    app,
    port
  };
}

let requestHandlerPromise: Promise<RequestHandler> | null = null;

async function getRequestHandler(): Promise<RequestHandler> {
  if (!requestHandlerPromise) {
    requestHandlerPromise = (async () => {
      const { app } = await createApiApp();

      await app.init();

      return app.getHttpAdapter().getInstance() as RequestHandler;
    })();
  }

  return requestHandlerPromise;
}

async function bootstrap() {
  const { app, port } = await createApiApp();
  await app.listen(port);
  writeStructuredApiLog("info", "api_started", {
    port
  });
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    const appHandler = await getRequestHandler();

    return appHandler(req, res);
  } catch (error) {
    console.error("vercel_api_bootstrap_failed", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        status: "failed",
        message: "API bootstrap failed."
      })
    );
  }
}

if (process.env.VERCEL !== "1") {
  void bootstrap();
}
