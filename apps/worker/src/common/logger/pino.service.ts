import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    formatters: {
      level: (label) => ({ level: label }),
    },
  });

  log(message: any, context?: string) {
    this.logger.info({ context }, String(message));
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error({ context, trace }, String(message));
  }

  warn(message: any, context?: string) {
    this.logger.warn({ context }, String(message));
  }

  debug(message: any, context?: string) {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: any, context?: string) {
    this.logger.trace({ context }, String(message));
  }
}
