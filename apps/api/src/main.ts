import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadApiBootstrapRuntime } from "./bootstrap/api-server.util";
import { ApiRequestLoggingInterceptor } from "./logging/api-request-logging.interceptor";
import { assignRequestContext } from "./logging/api-request-context";
import { ApiRequestMetricsService } from "./logging/api-request-metrics.service";
import { writeStructuredApiLog } from "./logging/structured-api-logger";

async function bootstrap() {
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

  await app.listen(port);
  writeStructuredApiLog("info", "api_started", {
    port
  });
}

bootstrap();
