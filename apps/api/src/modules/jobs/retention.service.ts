import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private prisma: PrismaService) {}

  // Executa semanalmente (meia-noite de domingo)
  @Cron(CronExpression.EVERY_WEEK)
  async purgeOldLogs() {
    this.logger.log('Iniciando limpeza de retenção semanal LGPD...');

    try {
      // 1. Limpar logs de e-mail com mais de 90 dias
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const emailPurgeResult = await this.prisma.emailLog.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Limpeza de EmailLog concluída. Removidos: ${emailPurgeResult.count} logs de e-mail anteriores a ${ninetyDaysAgo.toISOString()}`,
      );

      // 2. Limpar logs de auditoria com mais de 5 anos
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const auditPurgeResult = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: fiveYearsAgo,
          },
        },
      });

      this.logger.log(
        `Limpeza de AuditLog concluída. Removidos: ${auditPurgeResult.count} logs de auditoria anteriores a ${fiveYearsAgo.toISOString()}`,
      );
    } catch (error: any) {
      this.logger.error(`Erro ao executar a limpeza de logs de retenção LGPD: ${error.message}`, error.stack);
    }
  }
}
