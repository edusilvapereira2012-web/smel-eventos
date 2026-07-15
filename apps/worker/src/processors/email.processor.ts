import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import { PinoLoggerService } from '../common/logger/pino.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Processor('email')
export class EmailProcessor implements OnModuleInit {
  private transporter!: nodemailer.Transporter;

  constructor(
    private readonly logger: PinoLoggerService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('email-dead') private readonly emailDeadQueue: Queue,
  ) {}

  async onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    // Register repeatable cron job for reminders daily at 9:00 AM
    try {
      // Remove any existing repeatable job with the same ID to avoid duplicates
      const repeatableJobs = await this.emailQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === 'event-reminders-job') {
          await this.emailQueue.removeRepeatableByKey(job.key);
        }
      }

      await this.emailQueue.add(
        'send-event-reminders',
        {},
        {
          repeat: { cron: '0 9 * * *' },
          jobId: 'event-reminders-job',
          removeOnComplete: true,
        },
      );
      this.logger.log('Job recorrente de lembretes configurado para as 09:00 diariamente.', 'EmailProcessor');
    } catch (err: any) {
      this.logger.error('Falha ao registrar job recorrente de lembretes', err.stack, 'EmailProcessor');
    }
  }

  @Process('send-event-reminders')
  async handleSendEventRemindersJob(job: Job) {
    return this.handleSendEventReminders(job);
  }

  @Process('verify-email')
  async handleVerifyEmail(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('reset-password')
  async handleResetPassword(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('welcome')
  async handleWelcome(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('invite-member')
  async handleInviteMember(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('registration-confirmed')
  async handleRegistrationConfirmed(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('registration-waitlist')
  async handleRegistrationWaitlist(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('registration-cancelled')
  async handleRegistrationCancelled(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('waitlist-promoted')
  async handleWaitlistPromoted(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('event-cancelled')
  async handleEventCancelled(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('certificate-issued')
  async handleCertificateIssued(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process('event-reminder')
  async handleEventReminder(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  @Process()
  async handleDefaultJob(job: Job<{ emailLogId: string }>) {
    return this.handleEmailJob(job);
  }

  async handleSendEventReminders(job: Job) {
    this.logger.log(`[Job ${job.id}] Iniciando processamento de lembretes de eventos...`, 'EmailProcessor');
    
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const events = await this.prisma.event.findMany({
      where: {
        startDate: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
        status: 'PUBLISHED',
        reminderSent: false,
      },
    });

    this.logger.log(`Encontrados ${events.length} eventos para amanhã que necessitam de lembrete.`, 'EmailProcessor');

    for (const event of events) {
      const registrations = await this.prisma.registration.findMany({
        where: {
          eventId: event.id,
          status: 'CONFIRMED',
        },
      });

      this.logger.log(`Enviando lembretes para ${registrations.length} participantes do evento "${event.title}".`, 'EmailProcessor');

      for (const reg of registrations) {
        const emailLog = await this.prisma.emailLog.create({
          data: {
            tenantId: event.tenantId,
            to: reg.email,
            subject: `Lembrete: O evento "${event.title}" começa amanhã!`,
            template: 'event-reminder',
            variables: {
              name: reg.name,
              eventTitle: event.title,
              eventLocation: event.location || 'Presencial/Online',
              eventDate: event.startDate.toLocaleDateString('pt-BR'),
              eventTime: event.startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            },
            status: 'PENDING',
          },
        });

        await this.emailQueue.add(
          'event-reminder',
          { emailLogId: emailLog.id },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 100 },
            removeOnFail: false,
          },
        );
      }

      await this.prisma.event.update({
        where: { id: event.id },
        data: { reminderSent: true },
      });
    }

    this.logger.log(`[Job ${job.id}] Finalizado envio de lembretes de eventos.`, 'EmailProcessor');
  }

  async handleEmailJob(job: Job<{ emailLogId: string }>) {
    const { emailLogId } = job.data;
    if (!emailLogId) {
      this.logger.warn(`[Job ${job.id}] Job de e-mail recebido sem emailLogId. Abortando.`, 'EmailProcessor');
      return;
    }

    const log = await this.prisma.emailLog.findUnique({
      where: { id: emailLogId },
    });

    if (!log) {
      this.logger.warn(`[Job ${job.id}] EmailLog com ID ${emailLogId} não encontrado. Abortando.`, 'EmailProcessor');
      return;
    }

    this.logger.log(`[Job ${job.id}] Processando e-mail ID ${log.id} para ${log.to} (Template: ${log.template})`, 'EmailProcessor');

    // Get tenant configuration
    let tenantName = 'SMEL-Plataforma de Eventos';
    let tenantLogoUrl: string | null = null;

    if (log.tenantId !== 'system') {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: log.tenantId },
      });
      if (tenant) {
        tenantName = tenant.name;
        tenantLogoUrl = tenant.logoUrl;
      }
    }

    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const year = new Date().getFullYear();

    try {
      // Resolve template path
      const templatePath = path.join(__dirname, `../templates/emails/${log.template}.hbs`);
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Arquivo de template ${log.template}.hbs não encontrado no caminho: ${templatePath}`);
      }

      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateSource);

      const parsedVariables = log.variables as Record<string, any>;
      const bodyHtml = compiledTemplate({
        ...parsedVariables,
        tenantName,
        tenantLogoUrl,
        appUrl,
        year,
      });

      const layoutPath = path.join(__dirname, '../templates/emails/layouts/base.hbs');
      if (!fs.existsSync(layoutPath)) {
        throw new Error(`Arquivo de layout base.hbs não encontrado no caminho: ${layoutPath}`);
      }

      const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
      const compiledLayout = handlebars.compile(layoutSource);

      const finalHtml = compiledLayout({
        body: bodyHtml,
        subject: log.subject,
        tenantName,
        tenantLogoUrl,
        tenantId: log.tenantId,
        appUrl,
        year,
      });

      // Send email using SMTP
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM') || 'noreply@smel.gov.br',
        to: log.to,
        subject: log.subject,
        html: finalHtml,
      });

      // Update log to SENT
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempts: log.attempts + 1,
        },
      });

      this.logger.log(`[Job ${job.id}] E-mail enviado com sucesso e atualizado para SENT. ID: ${log.id}`, 'EmailProcessor');
    } catch (error: any) {
      const attempts = log.attempts + 1;
      const isLastAttempt = attempts >= 3;
      const status = isLastAttempt ? 'DEAD' : 'FAILED';

      this.logger.error(
        `[Job ${job.id}] Erro ao enviar e-mail (tentativa ${attempts}/3) para ${log.to}: ${error.message}`,
        error.stack,
        'EmailProcessor',
      );

      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status,
          attempts,
          lastError: error.message,
        },
      });

      if (isLastAttempt) {
        this.logger.error(`[Job ${job.id}] Envio permanentemente falho. Enviando para a Dead Letter Queue (email-dead).`, '', 'EmailProcessor');
        await this.emailDeadQueue.add(
          'dead-email',
          { emailLogId: log.id },
          { jobId: `dead-${log.id}` },
        );
      }

      if (!isLastAttempt) {
        throw error; // Re-throw to trigger BullMQ retry/backoff
      }
    }
  }
}
