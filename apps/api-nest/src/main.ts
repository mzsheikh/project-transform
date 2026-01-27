import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
  origin: true,
  credentials: true,
});
  app.use(cookieParser());
  await app.listen(3000);
}
bootstrap();
