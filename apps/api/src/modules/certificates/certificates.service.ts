import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('certificates') private readonly certificatesQueue: Queue,
  ) {}

  async generateBatch(eventId: string, tenantId: string) {
    // Verificar se o evento existe e pertence ao tenant
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        tenantId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado para este inquilino');
    }

    // Buscar inscrições confirmadas com check-in e sem certificado gerado
    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        status: 'CONFIRMED',
        checkedInAt: { not: null },
        certificate: { is: null },
      },
    });

    if (registrations.length === 0) {
      return {
        message: 'Nenhum certificado pendente para geração.',
        count: 0,
      };
    }

    // Adicionar jobs para a fila
    for (const reg of registrations) {
      await this.certificatesQueue.add(
        'generate-certificate',
        {
          registrationId: reg.id,
          tenantId,
          eventId,
        },
        {
          jobId: `certificate-${reg.id}`,
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
        },
      );
    }

    return {
      message: `${registrations.length} certificados enfileirados para geração.`,
      count: registrations.length,
    };
  }

  async findByCode(code: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
      include: {
        registration: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: certificate.eventId },
      select: {
        title: true,
        startDate: true,
      },
    });

    return {
      valid: true,
      participantName: certificate.registration.name,
      eventTitle: event?.title || '',
      eventDate: event?.startDate ? event.startDate.toISOString().split('T')[0] : '',
      issuedAt: certificate.issuedAt,
    };
  }

  async getCertificateDetails(code: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
      include: {
        registration: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: certificate.eventId },
      select: {
        title: true,
        startDate: true,
        endDate: true,
      },
    });

    return {
      id: certificate.id,
      code: certificate.code,
      fileUrl: certificate.fileUrl,
      issuedAt: certificate.issuedAt,
      downloadCount: certificate.downloadCount,
      participantName: certificate.registration.name,
      participantEmail: certificate.registration.email,
      eventTitle: event?.title || '',
      eventStartDate: event?.startDate,
      eventEndDate: event?.endDate,
    };
  }

  async getRegistrationCertificate(registrationId: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { registrationId },
    });

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado para esta inscrição');
    }

    return certificate;
  }

  async downloadCertificate(code: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
    });

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    await this.prisma.certificate.update({
      where: { code },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    return certificate.fileUrl;
  }
}
