/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นจุดเริ่มต้นของ NestJS API และทำหน้าที่ bootstrap แอปก่อนเปิดให้บริการ
 */

import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

/**
 * หน้าที่: สร้างและตั้งค่า NestJS application ก่อนเปิดพอร์ตให้บริการ
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const port = Number(process.env.API_PORT ?? 4000);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Chatto API")
    .setDescription("Phase 2 foundation API for Chatto")
    .setVersion("0.1.0")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  await app.listen(port);
}

void bootstrap();
