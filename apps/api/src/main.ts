import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadApiBootstrapRuntime } from "./bootstrap/api-server.util";

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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.enableCors({
    origin: corsOriginDelegate,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Internal-Operator-Api-Key",
      "X-Internal-Worker-Api-Key"
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400
  });

  await app.listen(port);
}

bootstrap();
