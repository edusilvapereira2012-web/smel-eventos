import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { RegistrationStatus, EventStatus } from '@prisma/client';
import {
  CreateRegistrationDto,
  TransferRegistrationDto,
  ListRegistrationsQueryDto,
} from './dto/registration.dto';
import { encrypt, decrypt, cleanCpf, maskCpf } from '../../common/utils/encryption.helper';
import { EventsGateway } from '../../gateways/events.gateway';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class RegistrationsService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditLog: AuditLogService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || 'default_secret_encryption_key_32_bytes_long';
  }

  /**
   * Helper to invalidate cache count of confirmed seats
   */
  private async invalidateSeatsCache(eventId: string): Promise<void> {
    await this.redis.del(`event:seats:${eventId}`);
  }

  /**
   * Helper to fetch/cache the number of confirmed registrations
   */
  async getConfirmedSeatsCount(eventId: string): Promise<number> {
    const cacheKey = `event:seats:${eventId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return Number(cached);
    }

    const count = await this.prisma.registration.count({
      where: {
        eventId,
        status: RegistrationStatus.CONFIRMED,
      },
    });

    await this.redis.set(cacheKey, String(count), 300); // 5 minutes TTL
    return count;
  }

  /**
   * Register a user to an event (concurrency-safe via transaction + lock)
   */
  async create(eventId: string, dto: CreateRegistrationDto, userId?: string | null, ip?: string, userAgent?: string) {
    // 1. Clean CPF and encrypt
    const rawCpf = cleanCpf(dto.cpf);
    if (rawCpf.length !== 11) {
      throw new BadRequestException('CPF inválido. Deve conter 11 dígitos.');
    }
    const encryptedCpf = encrypt(rawCpf, this.encryptionKey);

    // 2. Perform transactional registration
    const registration = await this.prisma.$transaction(async (tx) => {
      // Apply row lock on the Event
      const lockedEvents = await tx.$queryRaw<any[]>`
        SELECT id, title, slug, capacity, status FROM "Event" 
        WHERE id = ${eventId} FOR UPDATE
      `;

      if (!lockedEvents || lockedEvents.length === 0) {
        throw new NotFoundException('Evento não encontrado.');
      }

      const event = lockedEvents[0];

      if (event.status !== EventStatus.PUBLISHED) {
        throw new BadRequestException('Não é possível se inscrever em um evento que não está publicado.');
      }

      // Check if this email is already registered to this event with ACTIVE status
      const existing = await tx.registration.findFirst({
        where: {
          eventId,
          email: dto.email,
          status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLIST] },
        },
      });

      if (existing) {
        throw new ConflictException('Este participante já está inscrito ou na lista de espera deste evento.');
      }

      // Count current confirmed registrations
      const confirmedCount = await tx.registration.count({
        where: {
          eventId,
          status: RegistrationStatus.CONFIRMED,
        },
      });

      // Generate sequence code
      const prefix = event.slug.substring(0, 3).toUpperCase().padEnd(3, 'X');
      const year = new Date().getFullYear();
      const totalRegs = await tx.registration.count({ where: { eventId } });
      const seqStr = String(totalRegs + 1).padStart(5, '0');
      const code = `${prefix}-${year}-${seqStr}`;

      let status: RegistrationStatus = RegistrationStatus.CONFIRMED;
      let waitlistPosition: number | null = null;

      if (confirmedCount >= event.capacity) {
        status = RegistrationStatus.WAITLIST;
        // Calculate waitlist position
        const waitlistCount = await tx.registration.count({
          where: {
            eventId,
            status: RegistrationStatus.WAITLIST,
          },
        });
        waitlistPosition = waitlistCount + 1;
      }

      return tx.registration.create({
        data: {
          code,
          eventId,
          userId: userId || null,
          name: dto.name,
          email: dto.email,
          cpf: encryptedCpf,
          phone: dto.phone || null,
          status,
          waitlistPosition,
        },
        include: {
          event: true,
        },
      });
    });

    // 3. Post-transaction operations
    await this.invalidateSeatsCache(eventId);

    // Enqueue emails
    if (registration.status === RegistrationStatus.CONFIRMED) {
      await this.emailService.enqueue({
        tenantId: registration.event.tenantId,
        to: registration.email,
        template: 'registration-confirmed',
        variables: {
          name: registration.name,
          eventTitle: registration.event.title,
          code: registration.code,
        },
      });
    } else {
      await this.emailService.enqueue({
        tenantId: registration.event.tenantId,
        to: registration.email,
        template: 'registration-waitlist',
        variables: {
          name: registration.name,
          eventTitle: registration.event.title,
          position: registration.waitlistPosition,
        },
      });
    }

    // Invalidate dashboard overview cache
    const tenantId = registration.event.tenantId;
    await this.redis.del(`dashboard:overview:${tenantId}`);

    // Emit live event
    const total = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.CONFIRMED },
    });
    const waitlist = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.WAITLIST },
    });
    this.eventsGateway.emitToRegistrationNew(tenantId, { eventId, total, waitlist });

    await this.auditLog.log(
      userId || null,
      'CREATE_REGISTRATION',
      'registration',
      registration.id,
      { eventId, code: registration.code },
      ip,
      userAgent,
    );

    return {
      ...registration,
      cpf: maskCpf(dto.cpf),
    };
  }

  /**
   * List all registrations of an event (standard returns masked CPF)
   */
  async findAll(eventId: string, query: ListRegistrationsQueryDto, tenantId: string) {
    // Confirm event belongs to tenant
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado no tenant.');
    }

    const { status, search, cursor, limit } = query;
    const take = limit ? Math.min(Math.max(1, limit), 100) : 20;

    const where: any = { eventId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const registrations = await this.prisma.registration.findMany({
      where,
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: 'asc' },
    });

    let nextCursor: string | null = null;
    if (registrations.length > take) {
      const nextItem = registrations.pop();
      nextCursor = nextItem!.id;
    }

    // Mask CPFs
    const mapped = registrations.map((reg) => {
      try {
        const decrypted = decrypt(reg.cpf || '', this.encryptionKey);
        return {
          ...reg,
          cpf: maskCpf(decrypted),
        };
      } catch (err) {
        return {
          ...reg,
          cpf: '***.***.***-**',
        };
      }
    });

    return {
      data: mapped,
      nextCursor,
    };
  }

  /**
   * Export all registrations with plain CPFs (requires registration:view-cpf permission)
   */
  async exportCpf(eventId: string, tenantId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado no tenant.');
    }

    const registrations = await this.prisma.registration.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });

    return registrations.map((reg) => {
      try {
        const plainCpf = decrypt(reg.cpf || '', this.encryptionKey);
        return {
          id: reg.id,
          code: reg.code,
          name: reg.name,
          email: reg.email,
          cpf: plainCpf,
          phone: reg.phone,
          status: reg.status,
          waitlistPosition: reg.waitlistPosition,
          createdAt: reg.createdAt,
        };
      } catch (err) {
        return {
          ...reg,
          cpf: 'ERRO_DECRIPTO',
        };
      }
    });
  }

  /**
   * Get single registration
   */
  async findOne(eventId: string, id: string, tenantId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado no tenant.');
    }

    const registration = await this.prisma.registration.findFirst({
      where: { id, eventId },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    try {
      const decrypted = decrypt(registration.cpf || '', this.encryptionKey);
      return {
        ...registration,
        cpf: maskCpf(decrypted),
      };
    } catch {
      return {
        ...registration,
        cpf: '***.***.***-**',
      };
    }
  }

  /**
   * Get registration by registration code (used for check-in)
   */
  async findByCode(eventId: string, code: string, tenantId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado no tenant.');
    }

    const registration = await this.prisma.registration.findFirst({
      where: { code, eventId },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    try {
      const decrypted = decrypt(registration.cpf || '', this.encryptionKey);
      return {
        ...registration,
        cpf: maskCpf(decrypted),
      };
    } catch {
      return {
        ...registration,
        cpf: '***.***.***-**',
      };
    }
  }

  /**
   * Cancel registration (initiates waitlist promotion)
   */
  async cancel(
    eventId: string,
    id: string,
    cancelReason?: string,
    userId?: string | null,
    ip?: string,
    userAgent?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Row lock on event
      const lockedEvents = await tx.$queryRaw<any[]>`
        SELECT id, title, capacity, "tenantId" FROM "Event" WHERE id = ${eventId} FOR UPDATE
      `;
      if (!lockedEvents || lockedEvents.length === 0) {
        throw new NotFoundException('Evento não encontrado.');
      }
      const event = lockedEvents[0];

      const registration = await tx.registration.findFirst({
        where: { id, eventId },
      });

      if (!registration) {
        throw new NotFoundException('Inscrição não encontrada.');
      }

      if (registration.status === RegistrationStatus.CANCELLED || registration.status === RegistrationStatus.TRANSFERRED) {
        throw new BadRequestException('Inscrição já se encontra cancelada ou transferida.');
      }

      const originalStatus = registration.status;

      // Update current registration
      const updatedReg = await tx.registration.update({
        where: { id },
        data: {
          status: RegistrationStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: cancelReason || 'Cancelado por solicitação.',
          waitlistPosition: null,
        },
      });

      let promotedReg: any = null;

      // If the cancelled registration was CONFIRMED, promote the first in the waitlist
      if (originalStatus === RegistrationStatus.CONFIRMED) {
        const nextInWaitlist = await tx.registration.findFirst({
          where: {
            eventId,
            status: RegistrationStatus.WAITLIST,
          },
          orderBy: { waitlistPosition: 'asc' },
        });

        if (nextInWaitlist) {
          // Promote next in waitlist
          promotedReg = await tx.registration.update({
            where: { id: nextInWaitlist.id },
            data: {
              status: RegistrationStatus.CONFIRMED,
              waitlistPosition: null,
            },
          });

          // Shift all waitlist positions
          const remainingWaitlist = await tx.registration.findMany({
            where: {
              eventId,
              status: RegistrationStatus.WAITLIST,
            },
            orderBy: { waitlistPosition: 'asc' },
          });

          for (let i = 0; i < remainingWaitlist.length; i++) {
            await tx.registration.update({
              where: { id: remainingWaitlist[i].id },
              data: {
                waitlistPosition: i + 1,
              },
            });
          }
        }
      } else if (originalStatus === RegistrationStatus.WAITLIST) {
        // Shift remaining waitlist positions that were behind this one
        const position = registration.waitlistPosition || 0;
        const trailingWaitlist = await tx.registration.findMany({
          where: {
            eventId,
            status: RegistrationStatus.WAITLIST,
            waitlistPosition: { gt: position },
          },
          orderBy: { waitlistPosition: 'asc' },
        });

        for (const item of trailingWaitlist) {
          await tx.registration.update({
            where: { id: item.id },
            data: {
              waitlistPosition: (item.waitlistPosition || 1) - 1,
            },
          });
        }
      }

      return { updatedReg, promotedReg, eventTitle: event.title, tenantId: event.tenantId };
    });

    await this.invalidateSeatsCache(eventId);

    // Send cancel email
    await this.emailService.enqueue({
      tenantId: result.tenantId,
      to: result.updatedReg.email,
      template: 'registration-cancelled',
      variables: {
        name: result.updatedReg.name,
        eventTitle: result.eventTitle,
      },
    });

    // Send promotion email
    if (result.promotedReg) {
      await this.emailService.enqueue({
        tenantId: result.tenantId,
        to: result.promotedReg.email,
        template: 'waitlist-promoted',
        variables: {
          name: result.promotedReg.name,
          eventTitle: result.eventTitle,
          code: result.promotedReg.code,
        },
      });
    }

    // Invalidate dashboard overview cache
    await this.redis.del(`dashboard:overview:${result.tenantId}`);

    // Emit live events
    this.eventsGateway.emitToRegistrationCancelled(result.tenantId, { eventId });
    if (result.promotedReg) {
      const total = await this.prisma.registration.count({
        where: { eventId, status: RegistrationStatus.CONFIRMED },
      });
      const waitlist = await this.prisma.registration.count({
        where: { eventId, status: RegistrationStatus.WAITLIST },
      });
      this.eventsGateway.emitToRegistrationNew(result.tenantId, { eventId, total, waitlist });
    }

    await this.auditLog.log(
      userId || null,
      'CANCEL_REGISTRATION',
      'registration',
      id,
      { eventId, reason: cancelReason || 'Cancelado por solicitação.' },
      ip,
      userAgent,
    );

    return result.updatedReg;
  }

  /**
   * Public cancel with code and email validation
   */
  async publicCancel(code: string, email: string, cancelReason?: string, ip?: string, userAgent?: string) {
    const registration = await this.prisma.registration.findFirst({
      where: {
        code,
        email: { equals: email, mode: 'insensitive' },
      },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição não encontrada para o código e e-mail informados.');
    }

    return this.cancel(registration.eventId, registration.id, cancelReason, null, ip, userAgent);
  }

  /**
   * Transfer registration
   */
  async transfer(
    eventId: string,
    id: string,
    dto: TransferRegistrationDto,
    tenantId: string,
    userId?: string | null,
    ip?: string,
    userAgent?: string,
  ) {
    // Verify event ownership
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const rawCpf = cleanCpf(dto.cpf);
    if (rawCpf.length !== 11) {
      throw new BadRequestException('CPF inválido. Deve conter 11 dígitos.');
    }
    const encryptedCpf = encrypt(rawCpf, this.encryptionKey);

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock event row
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

      const sourceReg = await tx.registration.findFirst({
        where: { id, eventId },
      });

      if (!sourceReg) {
        throw new NotFoundException('Inscrição de origem não encontrada.');
      }

      if (sourceReg.status !== RegistrationStatus.CONFIRMED) {
        throw new BadRequestException('Apenas inscrições ativas e confirmadas podem ser transferidas.');
      }

      // Check if recipient is already registered to this event
      const recipientExisting = await tx.registration.findFirst({
        where: {
          eventId,
          email: dto.email,
          status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLIST] },
        },
      });

      if (recipientExisting) {
        throw new ConflictException('O participante de destino já se encontra inscrito neste evento.');
      }

      // Generate sequence code for the recipient
      const prefix = event.slug.substring(0, 3).toUpperCase().padEnd(3, 'X');
      const year = new Date().getFullYear();
      const totalRegs = await tx.registration.count({ where: { eventId } });
      const seqStr = String(totalRegs + 1).padStart(5, '0');
      const code = `${prefix}-${year}-${seqStr}`;

      // Create new registration for recipient
      const recipientReg = await tx.registration.create({
        data: {
          code,
          eventId,
          name: dto.name,
          email: dto.email,
          cpf: encryptedCpf,
          phone: dto.phone || null,
          status: RegistrationStatus.CONFIRMED,
        },
      });

      // Update source registration as TRANSFERRED
      const updatedSourceReg = await tx.registration.update({
        where: { id },
        data: {
          status: RegistrationStatus.TRANSFERRED,
          transferredTo: recipientReg.id,
        },
      });

      // Track reciprocal link on recipient
      const finalRecipientReg = await tx.registration.update({
        where: { id: recipientReg.id },
        data: {
          transferredFrom: sourceReg.id,
        },
      });

      return { updatedSourceReg, finalRecipientReg, eventTitle: event.title };
    });

    await this.invalidateSeatsCache(eventId);

    // Send emails
    await this.emailService.enqueue({
      tenantId: event.tenantId,
      to: result.finalRecipientReg.email,
      template: 'registration-confirmed',
      variables: {
        name: result.finalRecipientReg.name,
        eventTitle: result.eventTitle,
        code: result.finalRecipientReg.code,
      },
    });

    // Notify source of successful transfer
    await this.emailService.enqueue({
      tenantId: event.tenantId,
      to: result.updatedSourceReg.email,
      template: 'registration-cancelled',
      variables: {
        name: result.updatedSourceReg.name,
        eventTitle: `${result.eventTitle} (Transferido para ${result.finalRecipientReg.name})`,
      },
    });

    // Invalidate dashboard overview cache
    await this.redis.del(`dashboard:overview:${tenantId}`);

    // Emit live events
    this.eventsGateway.emitToRegistrationCancelled(tenantId, { eventId });
    const total = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.CONFIRMED },
    });
    const waitlist = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.WAITLIST },
    });
    this.eventsGateway.emitToRegistrationNew(tenantId, { eventId, total, waitlist });

    await this.auditLog.log(
      userId || null,
      'TRANSFER_REGISTRATION',
      'registration',
      id,
      { eventId, tenantId, recipientId: result.finalRecipientReg.id },
      ip,
      userAgent,
    );

    return result.finalRecipientReg;
  }
}
