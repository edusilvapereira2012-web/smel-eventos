import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PinoLoggerService } from './common/logger/pino.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);

  logger.log('🚀 SMEL-Plataforma de Eventos Worker context initialized successfully!');
  logger.log('📥 Listening for BullMQ jobs in queues: "email", "certificates"...');
}
bootstrap();
