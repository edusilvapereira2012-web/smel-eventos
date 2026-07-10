import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PinoLoggerService } from './common/logger/pino.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;

  // Habilitar Helmet para cabeçalhos de segurança
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permitir Swagger UI
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Configurar CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS') || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigins.split(','),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, x-tenant-id, X-Tenant-ID',
  });

  // Habilitar compressão Gzip
  app.use(compression());

  // Habilitar cookie parser
  app.use(cookieParser());

  // Prefixo global
  app.setGlobalPrefix('api');

  // Filtro de exceção global
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuração do Swagger (será exposto em api/docs)
  const config = new DocumentBuilder()
    .setTitle('SMEL-Plataforma de Eventos API')
    .setDescription('Documentação da API da Plataforma de Eventos SMEL-Plataforma de Eventos')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  logger.log(`🚀 API is running on: http://localhost:${port}/api`);
  logger.log(`📚 Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
bootstrap();
