import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    resource: string,
    resourceId: string | null,
    metadata: any = null,
    ip?: string,
    userAgent?: string,
  ) {
    const redactedMetadata = this.redact(metadata);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          metadata: redactedMetadata ? (redactedMetadata as any) : undefined,
          ip,
          userAgent,
        },
      });
    } catch (error) {
      // Falha ao registrar log de auditoria não deve derrubar a requisição principal,
      // mas deve ser logada no console do servidor.
      console.error('[AuditLogService] Failed to create audit log:', error);
    }
  }

  private redact(obj: any): any {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redact(item));
    }

    const redacted: any = {};
    const keysToRedact = [
      'cpf',
      'password',
      'passwordhash',
      'token',
      'secret',
      'phone',
      'email',
      'confirm',
      'variables',
      'cvv',
      'card',
    ];

    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (keysToRedact.includes(lowerKey)) {
        redacted[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object') {
        redacted[key] = this.redact(obj[key]);
      } else {
        redacted[key] = obj[key];
      }
    }
    return redacted;
  }
}
