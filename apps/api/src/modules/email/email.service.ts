import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export type EmailTemplate =
  | 'verify-email'
  | 'reset-password'
  | 'welcome'
  | 'invite-member'
  | 'registration-confirmed'
  | 'registration-waitlist'
  | 'registration-cancelled'
  | 'waitlist-promoted'
  | 'event-cancelled'
  | 'certificate-issued'
  | 'event-reminder';

export interface EnqueueEmailOptions {
  tenantId: string;
  to: string | string[];
  template: EmailTemplate;
  variables: Record<string, unknown>;
  subject?: string;
  priority?: number;
  delay?: number;
}

const SUBJECTS: Record<EmailTemplate, string> = {
  'verify-email': 'Ative sua conta — SMEL-Plataforma de Eventos',
  'reset-password': 'Recupere sua senha — SMEL-Plataforma de Eventos',
  'welcome': 'Bem-vindo ao SMEL-Plataforma de Eventos!',
  'invite-member': 'Você foi convidado para uma organização — SMEL-Plataforma de Eventos',
  'registration-confirmed': 'Inscrição Confirmada — SMEL-Plataforma de Eventos',
  'registration-waitlist': 'Você está na lista de espera — SMEL-Plataforma de Eventos',
  'registration-cancelled': 'Inscrição Cancelada — SMEL-Plataforma de Eventos',
  'waitlist-promoted': 'Vaga Confirmada! — SMEL-Plataforma de Eventos',
  'event-cancelled': 'Aviso: Evento Cancelado — SMEL-Plataforma de Eventos',
  'certificate-issued': 'Seu certificado está disponível! — SMEL-Plataforma de Eventos',
  'event-reminder': 'Lembrete de Evento — SMEL-Plataforma de Eventos',
};

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async enqueue(opts: EnqueueEmailOptions): Promise<void> {
    const toStr = Array.isArray(opts.to) ? opts.to.join(',') : opts.to;
    const subject = opts.subject || SUBJECTS[opts.template] || 'Notificação — SMEL-Plataforma de Eventos';

    // Cria o registro EmailLog com status PENDING
    const emailLog = await this.prisma.emailLog.create({
      data: {
        tenantId: opts.tenantId,
        to: toStr,
        subject,
        template: opts.template,
        variables: opts.variables as any,
        status: 'PENDING',
      },
    });

    // Adiciona job na fila BullMQ com emailLogId e configurações de retry
    await this.emailQueue.add(
      opts.template,
      { emailLogId: emailLog.id },
      {
        priority: opts.priority,
        delay: opts.delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );
  }
}
