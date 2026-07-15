import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateWorkshopDto, UpdateWorkshopDto } from './dto/workshop.dto';

@Injectable()
export class WorkshopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async checkEventOwner(eventId: string, tenantId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado neste tenant.');
    }
    return event;
  }

  async create(eventId: string, dto: CreateWorkshopDto, tenantId: string, userId: string, ip?: string, userAgent?: string) {
    await this.checkEventOwner(eventId, tenantId);

    if (dto.speakerId) {
      const speaker = await this.prisma.eventSpeaker.findFirst({
        where: { id: dto.speakerId, eventId },
      });
      if (!speaker) {
        throw new BadRequestException('O palestrante informado não pertence a este evento.');
      }
    }

    const workshop = await this.prisma.workshop.create({
      data: {
        eventId,
        title: dto.title,
        description: dto.description,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        capacity: dto.capacity,
        location: dto.location,
        speakerId: dto.speakerId || null,
      },
    });

    await this.auditLog.log(userId, 'CREATE_WORKSHOP', 'workshop', workshop.id, { eventId }, ip, userAgent);

    return workshop;
  }

  async findAll(eventId: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);

    return this.prisma.workshop.findMany({
      where: { eventId },
      include: {
        speaker: true,
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(eventId: string, id: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);

    const workshop = await this.prisma.workshop.findFirst({
      where: { id, eventId },
      include: {
        speaker: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException('Oficina não encontrada no evento.');
    }

    return workshop;
  }

  async update(eventId: string, id: string, dto: UpdateWorkshopDto, tenantId: string, userId: string, ip?: string, userAgent?: string) {
    await this.checkEventOwner(eventId, tenantId);

    const workshop = await this.prisma.workshop.findFirst({
      where: { id, eventId },
    });

    if (!workshop) {
      throw new NotFoundException('Oficina não encontrada no evento.');
    }

    if (dto.speakerId) {
      const speaker = await this.prisma.eventSpeaker.findFirst({
        where: { id: dto.speakerId, eventId },
      });
      if (!speaker) {
        throw new BadRequestException('O palestrante informado não pertence a este evento.');
      }
    }

    const updateData: any = { ...dto };
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime) updateData.endTime = new Date(dto.endTime);
    if (dto.speakerId === null || dto.speakerId === '') updateData.speakerId = null;

    const updated = await this.prisma.workshop.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog.log(userId, 'UPDATE_WORKSHOP', 'workshop', id, { eventId }, ip, userAgent);

    return updated;
  }

  async remove(eventId: string, id: string, tenantId: string, userId: string, ip?: string, userAgent?: string) {
    await this.checkEventOwner(eventId, tenantId);

    const workshop = await this.prisma.workshop.findFirst({
      where: { id, eventId },
    });

    if (!workshop) {
      throw new NotFoundException('Oficina não encontrada no evento.');
    }

    await this.prisma.workshop.delete({
      where: { id },
    });

    await this.auditLog.log(userId, 'DELETE_WORKSHOP', 'workshop', id, { eventId }, ip, userAgent);

    return { success: true };
  }

  // --- PUBLIC SERVICES ---

  async listWorkshopsPublic(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado ou não publicado.');
    }

    const workshops = await this.prisma.workshop.findMany({
      where: { eventId: event.id },
      include: {
        speaker: {
          select: {
            id: true,
            name: true,
            bio: true,
            photoUrl: true,
            role: true,
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return {
      maxWorkshops: event.maxWorkshops,
      workshops: workshops.map((w) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        startTime: w.startTime,
        endTime: w.endTime,
        capacity: w.capacity,
        location: w.location,
        speaker: w.speaker,
        vacancies: Math.max(0, w.capacity - w._count.enrollments),
        enrolledCount: w._count.enrollments,
      })),
    };
  }

  // --- ENROLLMENTS LOGIC ---

  async getEnrollments(eventId: string, id: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);

    const workshop = await this.prisma.workshop.findFirst({
      where: { id, eventId },
    });

    if (!workshop) {
      throw new NotFoundException('Oficina não encontrada no evento.');
    }

    return this.prisma.workshopEnrollment.findMany({
      where: { workshopId: id },
      include: {
        registration: {
          select: {
            id: true,
            code: true,
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async enrollParticipant(
    eventId: string,
    registrationId: string,
    workshopId: string,
    tenantId: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    await this.checkEventOwner(eventId, tenantId);

    // Enroll inside transaction with pessimistic locking
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock Event
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new NotFoundException('Evento não encontrado.');

      // 2. Lock and fetch Registration
      const registration = await tx.registration.findUnique({
        where: { id: registrationId },
      });
      if (!registration || registration.eventId !== eventId) {
        throw new NotFoundException('Inscrição no evento não encontrada.');
      }
      if (registration.status !== 'CONFIRMED') {
        throw new BadRequestException('Apenas participantes com inscrição confirmada podem se inscrever em oficinas.');
      }

      // 3. Lock Workshop
      const workshopsLocked: any[] = await tx.$queryRaw`
        SELECT id, title, capacity, "startTime", "endTime" 
        FROM "Workshop" 
        WHERE id = ${workshopId} 
        FOR UPDATE
      `;
      if (workshopsLocked.length === 0) {
        throw new NotFoundException('Oficina não encontrada.');
      }
      const workshop = workshopsLocked[0];

      // 4. Check capacity
      const currentEnrollmentsCount = await tx.workshopEnrollment.count({
        where: { workshopId },
      });
      if (currentEnrollmentsCount >= workshop.capacity) {
        throw new BadRequestException(`Vagas esgotadas para a oficina "${workshop.title}".`);
      }

      // 5. Check if already enrolled
      const alreadyEnrolled = await tx.workshopEnrollment.findUnique({
        where: {
          registrationId_workshopId: {
            registrationId,
            workshopId,
          },
        },
      });
      if (alreadyEnrolled) {
        return alreadyEnrolled; // Idempotente
      }

      // 6. Check maxWorkshops limit
      if (event.maxWorkshops > 0) {
        const userEnrollmentsCount = await tx.workshopEnrollment.count({
          where: {
            registrationId,
            workshop: { eventId },
          },
        });
        if (userEnrollmentsCount >= event.maxWorkshops) {
          throw new BadRequestException(
            `Você atingiu o limite máximo de ${event.maxWorkshops} oficinas para este evento.`,
          );
        }
      }

      // 7. Check for schedule conflicts
      const existingEnrollments = await tx.workshopEnrollment.findMany({
        where: {
          registrationId,
          workshop: { eventId },
        },
        include: { workshop: true },
      });

      const wStartTime = new Date(workshop.startTime).getTime();
      const wEndTime = new Date(workshop.endTime).getTime();

      for (const enc of existingEnrollments) {
        const activeW = enc.workshop;
        const activeStartTime = new Date(activeW.startTime).getTime();
        const activeEndTime = new Date(activeW.endTime).getTime();

        // Overlap: s1 < e2 && s2 < e1
        if (activeStartTime < wEndTime && wStartTime < activeEndTime) {
          throw new BadRequestException(
            `Conflito de horário: esta oficina conflita com a oficina "${activeW.title}" (${new Date(
              activeW.startTime,
            ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${new Date(
              activeW.endTime,
            ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}).`,
          );
        }
      }

      // 8. Enroll
      const enrollment = await tx.workshopEnrollment.create({
        data: {
          registrationId,
          workshopId,
        },
      });

      if (userId) {
        await this.auditLog.log(
          userId,
          'ENROLL_WORKSHOP',
          'workshop_enrollment',
          enrollment.id,
          { eventId, registrationId, workshopId },
          ip,
          userAgent,
        );
      }

      return enrollment;
    });
  }

  async cancelParticipantEnrollment(
    eventId: string,
    registrationId: string,
    workshopId: string,
    tenantId: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    await this.checkEventOwner(eventId, tenantId);

    const enrollment = await this.prisma.workshopEnrollment.findFirst({
      where: {
        registrationId,
        workshopId,
        workshop: { eventId },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Inscrição na oficina não encontrada.');
    }

    await this.prisma.workshopEnrollment.delete({
      where: { id: enrollment.id },
    });

    if (userId) {
      await this.auditLog.log(
        userId,
        'CANCEL_ENROLL_WORKSHOP',
        'workshop_enrollment',
        enrollment.id,
        { eventId, registrationId, workshopId },
        ip,
        userAgent,
      );
    }

    return { success: true };
  }
}
