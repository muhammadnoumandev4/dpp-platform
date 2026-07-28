import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());

  // Explicit allowlist — reflecting every origin (origin: true) while
  // credentials are enabled effectively disables the same-origin policy.
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', trustProxy === 'true' ? 1 : Number(trustProxy) || trustProxy);
  }
  app.enableShutdownHooks();
  // Uploads are served by MediaController with tenant/public ACL — not as a
  // world-readable static directory.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Notarify Digital Passport Platform API')
    .setDescription('API for the Notarify Digital Passport Platform')
    .setVersion('0.1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`API listening on port ${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
