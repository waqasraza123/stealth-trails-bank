import {
  ValidationPipe,
  type INestApplication,
  type Provider,
  type Type
} from "@nestjs/common";
import {
  Test,
  type TestingModule,
  type TestingModuleBuilder
} from "@nestjs/testing";

type CreateIntegrationTestAppOptions = {
  controllers?: Type<unknown>[];
  providers?: Provider[];
};

export async function createIntegrationTestApp(
  options: CreateIntegrationTestAppOptions
): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
}> {
  let moduleBuilder: TestingModuleBuilder = Test.createTestingModule({
    controllers: options.controllers ?? [],
    providers: options.providers ?? []
  });

  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  const httpAdapterInstance = app.getHttpAdapter().getInstance?.();

  if (
    httpAdapterInstance &&
    typeof httpAdapterInstance.disable === "function"
  ) {
    httpAdapterInstance.disable("x-powered-by");
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.init();

  return {
    app,
    moduleRef
  };
}
