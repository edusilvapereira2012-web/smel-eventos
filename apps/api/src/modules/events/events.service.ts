import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { EventStatus } from '@prisma/client';
import { CreateEventDto, UpdateEventDto, ListEventsQueryDto } from './dto/event.dto';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSpeakerDto,
  UpdateSpeakerDto,
  CreateSponsorDto,
  UpdateSponsorDto,
  CreateScheduleItemDto,
  UpdateScheduleItemDto,
} from './dto/subresources.dto';

// Helper slugify function
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w\-]+/g, '') // remove all non-word chars
    .replace(/\-\-+/g, '-') // replace multiple - with single -
    .replace(/^-+/, '') // trim - from start
    .replace(/-+$/, ''); // trim - from end
}

import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditLog: AuditLogService,
    private readonly redisService: RedisService,
  ) {}

  // --- EVENTS ---

  async create(createEventDto: CreateEventDto, tenantId: string, userId?: string, ip?: string, userAgent?: string) {
    let slug = slugify(createEventDto.title);
    
    // Conflit resolution for slug within the tenant
    let exists = await this.prisma.event.findUnique({
      where: {
        tenantId_slug: { tenantId, slug },
      },
    });

    let count = 1;
    const baseSlug = slug;
    while (exists) {
      slug = `${baseSlug}-${count}`;
      exists = await this.prisma.event.findUnique({
        where: {
          tenantId_slug: { tenantId, slug },
        },
      });
      count++;
    }

    const event = await this.prisma.event.create({
      data: {
        ...createEventDto,
        slug,
        tenantId,
        startDate: new Date(createEventDto.startDate),
        endDate: new Date(createEventDto.endDate),
      },
    });

    if (userId) {
      await this.auditLog.log(userId, 'CREATE_EVENT', 'event', event.id, {}, ip, userAgent);
    }

    return event;
  }

  async findAll(query: ListEventsQueryDto, tenantId: string) {
    const { cursor, limit, status, categoryId, dateRange, search } = query;
    const take = limit ? Math.min(Math.max(1, limit), 100) : 20;

    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (dateRange === 'upcoming') {
      where.endDate = {
        gte: new Date(),
      };
    } else if (dateRange === 'past') {
      where.endDate = {
        lt: new Date(),
      };
    }

    const total = await this.prisma.event.count({ where });

    const events = await this.prisma.event.findMany({
      where,
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'asc' },
      include: {
        category: true,
        speakers: true,
        sponsors: true,
      },
    });

    let nextCursor: string | null = null;
    if (events.length > take) {
      const nextItem = events.pop();
      nextCursor = nextItem!.id;
    }

    return {
      data: events,
      nextCursor,
      total,
    };
  }

  async findOne(id: string, tenantId: string) {
    const cacheKey = `event:${tenantId}:${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }

    const event = await this.prisma.event.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        speakers: true,
        sponsors: true,
        schedule: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado neste tenant.');
    }

    await this.redisService.set(cacheKey, JSON.stringify(event), 60);

    return event;
  }

  async findBySlug(slug: string) {
    const cacheKey = `event:slug:${slug}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }

    const event = await this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
      include: {
        category: true,
        speakers: true,
        sponsors: true,
        schedule: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento público não encontrado.');
    }

    await this.redisService.set(cacheKey, JSON.stringify(event), 300);

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto, tenantId: string, userId?: string, ip?: string, userAgent?: string) {
    const event = await this.findOne(id, tenantId);

    const { justification, ...restDto } = updateEventDto;
    const updateData: any = { ...restDto };

    if (updateEventDto.startDate) {
      updateData.startDate = new Date(updateEventDto.startDate);
    }
    if (updateEventDto.endDate) {
      updateData.endDate = new Date(updateEventDto.endDate);
    }

    if (updateEventDto.title && updateEventDto.title !== event.title) {
      let slug = slugify(updateEventDto.title);
      let exists = await this.prisma.event.findFirst({
        where: {
          tenantId,
          slug,
          NOT: { id },
        },
      });

      let count = 1;
      const baseSlug = slug;
      while (exists) {
        slug = `${baseSlug}-${count}`;
        exists = await this.prisma.event.findFirst({
          where: {
            tenantId,
            slug,
            NOT: { id },
          },
        });
        count++;
      }
      updateData.slug = slug;
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: updateData,
    });

    if (userId) {
      const changes: string[] = [];
      for (const key of Object.keys(restDto)) {
        if ((event as any)[key] !== (updatedEvent as any)[key]) {
          changes.push(key);
        }
      }
      await this.auditLog.log(
        userId,
        'UPDATE_EVENT',
        'event',
        id,
        {
          justification: justification || null,
          changes,
        },
        ip,
        userAgent,
      );
    }

    await this.invalidateEventCache(id, tenantId, event.slug);
    if (updatedEvent.slug !== event.slug) {
      await this.invalidateEventCache(id, tenantId, updatedEvent.slug);
    }

    return updatedEvent;
  }

  async remove(id: string, tenantId: string) {
    const event = await this.findOne(id, tenantId);

    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Apenas eventos com status DRAFT podem ser excluídos.');
    }

    const activeRegsCount = await this.prisma.registration.count({
      where: {
        eventId: id,
        status: { in: ['CONFIRMED', 'WAITLIST'] },
      },
    });

    if (activeRegsCount > 0) {
      throw new BadRequestException('Não é possível deletar um evento com inscrições ativas.');
    }

    await this.prisma.event.delete({
      where: { id },
    });

    await this.invalidateEventCache(id, tenantId, event.slug);

    return { success: true };
  }

  // --- TRANSITIONS ---

  async publish(id: string, tenantId: string, userId: string, ip?: string, userAgent?: string) {
    const event = await this.findOne(id, tenantId);

    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Apenas eventos no estado DRAFT podem ser publicados.');
    }

    if (!event.title || !event.startDate || !event.endDate || event.capacity <= 0) {
      throw new BadRequestException(
        'Campos obrigatórios ausentes ou inválidos. O evento precisa de título, datas válidas e capacidade > 0 para ser publicado.',
      );
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
    });

    await this.auditLog.log(userId, 'PUBLISH_EVENT', 'event', id, {}, ip, userAgent);
    await this.invalidateEventCache(id, tenantId, event.slug);

    return updated;
  }

  async cancel(id: string, tenantId: string, userId: string, ip?: string, userAgent?: string) {
    const event = await this.findOne(id, tenantId);

    if (event.status === EventStatus.CANCELLED || event.status === EventStatus.FINISHED) {
      throw new BadRequestException('Não é possível cancelar um evento já finalizado ou cancelado.');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });

    // Enfileira disparos de e-mails para inscritos ativos
    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId: id,
        status: { in: ['CONFIRMED', 'WAITLIST'] },
      },
    });

    for (const reg of registrations) {
      await this.emailService.enqueue({
        tenantId: event.tenantId,
        to: reg.email,
        template: 'event-cancelled',
        variables: {
          name: reg.name,
          eventTitle: event.title,
          registrationId: reg.id,
        },
      });
    }

    await this.auditLog.log(userId, 'CANCEL_EVENT', 'event', id, {}, ip, userAgent);
    await this.invalidateEventCache(id, tenantId, event.slug);

    return updated;
  }

  async finish(id: string, tenantId: string, userId: string, ip?: string, userAgent?: string) {
    const event = await this.findOne(id, tenantId);

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Apenas eventos publicados podem ser finalizados.');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.FINISHED },
    });

    await this.auditLog.log(userId, 'FINISH_EVENT', 'event', id, {}, ip, userAgent);
    await this.invalidateEventCache(id, tenantId, event.slug);

    return updated;
  }

  // --- SUB-RESOURCES: CATEGORIES ---

  async getCategories(tenantId: string) {
    return this.prisma.eventCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(createCategoryDto: CreateCategoryDto, tenantId: string) {
    const existing = await this.prisma.eventCategory.findFirst({
      where: {
        tenantId,
        name: { equals: createCategoryDto.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException('Uma categoria com este nome já existe neste tenant.');
    }

    return this.prisma.eventCategory.create({
      data: {
        ...createCategoryDto,
        tenantId,
      },
    });
  }

  async updateCategory(id: string, updateCategoryDto: UpdateCategoryDto, tenantId: string) {
    const category = await this.prisma.eventCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    if (updateCategoryDto.name && updateCategoryDto.name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await this.prisma.eventCategory.findFirst({
        where: {
          tenantId,
          name: { equals: updateCategoryDto.name, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException('Uma categoria com este nome já existe.');
      }
    }

    return this.prisma.eventCategory.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async deleteCategory(id: string, tenantId: string) {
    const category = await this.prisma.eventCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    await this.prisma.eventCategory.delete({
      where: { id },
    });

    return { success: true };
  }

  // --- SUB-RESOURCES: SPEAKERS ---

  private async checkEventOwner(eventId: string, tenantId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      throw new NotFoundException('Evento não encontrado neste tenant.');
    }
  }

  async getSpeakers(eventId: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    return this.prisma.eventSpeaker.findMany({
      where: { eventId },
    });
  }

  async createSpeaker(eventId: string, dto: CreateSpeakerDto, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    return this.prisma.eventSpeaker.create({
      data: {
        ...dto,
        eventId,
      },
    });
  }

  async updateSpeaker(eventId: string, id: string, dto: UpdateSpeakerDto, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    const speaker = await this.prisma.eventSpeaker.findFirst({
      where: { id, eventId },
    });
    if (!speaker) {
      throw new NotFoundException('Palestrante não encontrado no evento.');
    }
    return this.prisma.eventSpeaker.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSpeaker(eventId: string, id: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    const speaker = await this.prisma.eventSpeaker.findFirst({
      where: { id, eventId },
    });
    if (!speaker) {
      throw new NotFoundException('Palestrante não encontrado no evento.');
    }
    await this.prisma.eventSpeaker.delete({
      where: { id },
    });
    return { success: true };
  }

  // --- SUB-RESOURCES: SPONSORS ---

  async getSponsors(eventId: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    return this.prisma.eventSponsor.findMany({
      where: { eventId },
    });
  }

  async createSponsor(eventId: string, dto: CreateSponsorDto, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    return this.prisma.eventSponsor.create({
      data: {
        ...dto,
        eventId,
      },
    });
  }

  async updateSponsor(eventId: string, id: string, dto: UpdateSponsorDto, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    const sponsor = await this.prisma.eventSponsor.findFirst({
      where: { id, eventId },
    });
    if (!sponsor) {
      throw new NotFoundException('Patrocinador não encontrado no evento.');
    }
    return this.prisma.eventSponsor.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSponsor(eventId: string, id: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    const sponsor = await this.prisma.eventSponsor.findFirst({
      where: { id, eventId },
    });
    if (!sponsor) {
      throw new NotFoundException('Patrocinador não encontrado no evento.');
    }
    await this.prisma.eventSponsor.delete({
      where: { id },
    });
    return { success: true };
  }

  // --- SUB-RESOURCES: SCHEDULE ---

  async getSchedule(eventId: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    return this.prisma.scheduleItem.findMany({
      where: { eventId },
      orderBy: { order: 'asc' },
    });
  }

  async createScheduleItem(eventId: string, dto: CreateScheduleItemDto, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    return this.prisma.scheduleItem.create({
      data: {
        ...dto,
        eventId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
    });
  }

  async updateScheduleItem(eventId: string, id: string, dto: UpdateScheduleItemDto, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    const item = await this.prisma.scheduleItem.findFirst({
      where: { id, eventId },
    });
    if (!item) {
      throw new NotFoundException('Item de programação não encontrado no evento.');
    }

    const updateData: any = { ...dto };
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime) updateData.endTime = new Date(dto.endTime);

    return this.prisma.scheduleItem.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteScheduleItem(eventId: string, id: string, tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);
    const item = await this.prisma.scheduleItem.findFirst({
      where: { id, eventId },
    });
    if (!item) {
      throw new NotFoundException('Item de programação não encontrado no evento.');
    }
    await this.prisma.scheduleItem.delete({
      where: { id },
    });
    return { success: true };
  }

  async reorderSchedule(eventId: string, ids: string[], tenantId: string) {
    await this.checkEventOwner(eventId, tenantId);

    // Verify all ids belong to the event
    const items = await this.prisma.scheduleItem.findMany({
      where: {
        id: { in: ids },
        eventId,
      },
      select: { id: true },
    });

    if (items.length !== ids.length) {
      throw new BadRequestException('Alguns IDs de programação fornecidos não pertencem a este evento.');
    }

    // Execute sequential updates in a transaction
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.scheduleItem.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  }

  private async invalidateEventCache(eventId: string, tenantId: string, slug?: string) {
    try {
      await this.redisService.del(`event:${tenantId}:${eventId}`);
      if (slug) {
        await this.redisService.del(`event:slug:${slug}`);
      } else {
        const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
        if (event?.slug) {
          await this.redisService.del(`event:slug:${event.slug}`);
        }
      }
    } catch (e) {
      // Ignorar erros de cache para resiliência
    }
  }
}
