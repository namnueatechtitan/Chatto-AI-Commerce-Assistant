import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

// keeps original request body for signature verification (e.g. LINE webhook)
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const port = Number(process.env.API_PORT ?? 4000);
  // validation pipe is applied globally to all incoming requests, so we can validate DTOs and transform payloads into class instances

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
// swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Chatto API")
    .setDescription("Phase 2 foundation API for Chatto")
    .setVersion("0.1.0")
    .build();
// create swagger document and setup swagger endpoint
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  await app.listen(port);
}

void bootstrap();
