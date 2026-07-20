import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('certificates') private readonly certificatesQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async generateBatch(
    eventId: string,
    tenantId: string,
    payload: {
      registrationIds?: string[];
      type?: string;
      workshopId?: string;
      customTitle?: string;
      hours?: number;
    } = {},
  ) {
    // Verificar se o evento existe e pertence ao tenant
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        tenantId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado para esta organização');
    }

    const { registrationIds, type = 'EVENT', workshopId, customTitle, hours } = payload;

    const where: any = {
      eventId,
      status: 'CONFIRMED',
      checkedInAt: { not: null },
    };

    if (registrationIds && registrationIds.length > 0) {
      where.id = { in: registrationIds };
    }

    if (type === 'EVENT') {
      where.certificates = {
        none: {
          type: 'EVENT',
        },
      };
    } else if (type === 'WORKSHOP') {
      if (!workshopId) {
        throw new BadRequestException('ID da oficina é obrigatório para certificados de oficina.');
      }
      where.workshopEnrollments = {
        some: {
          workshopId,
        },
      };
      where.certificates = {
        none: {
          type: 'WORKSHOP',
          workshopId,
        },
      };
    } else if (type === 'CUSTOM') {
      if (!customTitle) {
        throw new BadRequestException('Título da atividade é obrigatório para certificados personalizados.');
      }
      where.certificates = {
        none: {
          type: 'CUSTOM',
          customTitle,
        },
      };
    }

    const registrations = await this.prisma.registration.findMany({
      where,
    });

    if (registrations.length === 0) {
      return {
        message: 'Nenhum certificado pendente para geração.',
        count: 0,
      };
    }

    // Adicionar jobs para a fila
    for (const reg of registrations) {
      const jobIdRaw = `certificate-${reg.id}-${type}-${workshopId || customTitle || 'main'}`;
      const jobId = jobIdRaw.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

      await this.certificatesQueue.add(
        'generate-certificate',
        {
          registrationId: reg.id,
          tenantId,
          eventId,
          type,
          workshopId,
          customTitle,
          hours,
        },
        {
          jobId,
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

  async generateIndividual(
    registrationId: string,
    tenantId: string,
    payload: {
      type?: string;
      workshopId?: string;
      customTitle?: string;
      hours?: number;
    } = {},
  ) {
    const { type = 'EVENT', workshopId, customTitle, hours } = payload;

    const reg = await this.prisma.registration.findFirst({
      where: {
        id: registrationId,
        status: 'CONFIRMED',
        checkedInAt: { not: null },
        event: { tenantId },
      },
      include: {
        event: true,
        certificates: {
          where: {
            type,
            workshopId: type === 'WORKSHOP' ? workshopId : undefined,
            customTitle: type === 'CUSTOM' ? customTitle : undefined,
          },
        },
      },
    });

    if (!reg) {
      throw new NotFoundException('Inscrição não encontrada ou participante não efetuou check-in.');
    }

    if (reg.certificates.length > 0) {
      return {
        message: 'Certificado já gerado para esta inscrição.',
        certificate: reg.certificates[0],
      };
    }

    if (type === 'WORKSHOP') {
      if (!workshopId) {
        throw new BadRequestException('ID da oficina é obrigatório para certificados de oficina.');
      }
      const isEnrolled = await this.prisma.workshopEnrollment.findUnique({
        where: {
          registrationId_workshopId: {
            registrationId,
            workshopId,
          },
        },
      });
      if (!isEnrolled) {
        throw new BadRequestException('O participante não está inscrito nesta oficina.');
      }
    } else if (type === 'CUSTOM') {
      if (!customTitle) {
        throw new BadRequestException('Título da atividade é obrigatório para certificados personalizados.');
      }
    }

    const jobIdRaw = `certificate-${reg.id}-${type}-${workshopId || customTitle || 'main'}`;
    const jobId = jobIdRaw.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    await this.certificatesQueue.add(
      'generate-certificate',
      {
        registrationId: reg.id,
        tenantId,
        eventId: reg.eventId,
        type,
        workshopId,
        customTitle,
        hours,
      },
      {
        jobId,
        attempts: 3,
        backoff: 5000,
        removeOnComplete: true,
      },
    );

    return {
      message: 'Geração de certificado enfileirada com sucesso.',
      registrationId: reg.id,
    };
  }

  private getEditDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1  // deletion
            )
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private async findCertificateRobustly(code: string) {
    const upperCode = code.toUpperCase().trim();
    
    // 1. Tentar busca exata no banco de dados
    let certificate = await this.prisma.certificate.findUnique({
      where: { code: upperCode },
    });

    if (certificate) {
      return certificate;
    }

    // 2. Se falhar, tentar busca case-insensitive e com remoção de caracteres especiais ou pequenos erros de digitação (distância de Levenshtein)
    const cleanCode = upperCode.replace('CERT-', '').replace(/[^A-Z0-9]/g, '');
    
    // Buscar todos os certificados para comparação (geralmente poucos ou podemos filtrar por similaridade do começo do código se necessário)
    const allCertificates = await this.prisma.certificate.findMany();
    
    for (const cert of allCertificates) {
      const dbClean = cert.code.toUpperCase().replace('CERT-', '').replace(/[^A-Z0-9]/g, '');
      if (dbClean === cleanCode) {
        return cert;
      }
      
      // Se a distância de edição for menor ou igual a 2 caracteres (erro de digitação/leitura do scanner)
      if (this.getEditDistance(dbClean, cleanCode) <= 2) {
        return cert;
      }
    }

    return null;
  }

  async findByCode(code: string) {
    const certificate = await this.findCertificateRobustly(code);

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id: certificate.registrationId },
      select: {
        name: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição associada não encontrada');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: certificate.eventId },
      select: {
        title: true,
        startDate: true,
      },
    });

    let activityTitle = '';
    if (certificate.type === 'WORKSHOP' && certificate.workshopId) {
      const workshop = await this.prisma.workshop.findUnique({
        where: { id: certificate.workshopId },
        select: { title: true },
      });
      activityTitle = workshop?.title || '';
    } else if (certificate.type === 'CUSTOM') {
      activityTitle = certificate.customTitle || '';
    }

    return {
      valid: true,
      participantName: registration.name,
      eventTitle: event?.title || '',
      eventDate: event?.startDate ? event.startDate.toISOString().split('T')[0] : '',
      issuedAt: certificate.issuedAt,
      type: certificate.type,
      activityTitle,
      hours: certificate.hours,
    };
  }

  async getCertificateDetails(code: string) {
    const certificate = await this.findCertificateRobustly(code);

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id: certificate.registrationId },
      select: {
        name: true,
        email: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição associada não encontrada');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: certificate.eventId },
      select: {
        title: true,
        startDate: true,
        endDate: true,
      },
    });

    let activityTitle = '';
    if (certificate.type === 'WORKSHOP' && certificate.workshopId) {
      const workshop = await this.prisma.workshop.findUnique({
        where: { id: certificate.workshopId },
        select: { title: true },
      });
      activityTitle = workshop?.title || '';
    } else if (certificate.type === 'CUSTOM') {
      activityTitle = certificate.customTitle || '';
    }

    return {
      id: certificate.id,
      code: certificate.code,
      fileUrl: certificate.fileUrl,
      issuedAt: certificate.issuedAt,
      downloadCount: certificate.downloadCount,
      participantName: registration.name,
      participantEmail: registration.email,
      eventTitle: event?.title || '',
      eventStartDate: event?.startDate,
      eventEndDate: event?.endDate,
      type: certificate.type,
      activityTitle,
      hours: certificate.hours,
    };
  }

  async getRegistrationCertificate(registrationId: string) {
    const certificates = await this.prisma.certificate.findMany({
      where: { registrationId },
      include: {
        workshop: {
          select: {
            title: true,
          },
        },
      },
    });

    return certificates;
  }

  async downloadCertificate(code: string) {
    const certificate = await this.findCertificateRobustly(code);

    if (!certificate) {
      throw new NotFoundException('Certificado não encontrado');
    }

    await this.prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    let fileUrl = certificate.fileUrl;
    const externalUrl = this.configService.get<string>('MINIO_EXTERNAL_URL');
    if (externalUrl) {
      fileUrl = fileUrl.replace(/^http:\/\/(localhost|minio):9000/, externalUrl);
    }

    return fileUrl;
  }
}
