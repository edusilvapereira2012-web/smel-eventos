import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CheckInGateway } from './checkin.gateway';
import { EventsGateway } from '../../gateways/events.gateway';
import { RegistrationStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';

interface QRCodePayload {
  sub: string;      // registrationId
  code: string;     // código legível
  eventId: string;
  iat: number;
}

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly checkInGateway: CheckInGateway,
    private readonly eventsGateway: EventsGateway,
    private readonly auditLog: AuditLogService,
  ) {}

  async validateAndCheckIn(token: string, operatorId?: string, deviceId?: string, ip?: string, userAgent?: string) {
    let payload: QRCodePayload;
    const qrSecret = this.configService.get<string>('QR_SECRET') || 'super_secret_qr_signature_key_32_bytes_long_12345';

    try {
      payload = this.jwtService.verify<QRCodePayload>(token, { secret: qrSecret });
    } catch (err: any) {
      await this.auditLog.log(
        operatorId || null,
        'CHECKIN_FAILURE',
        'checkin',
        null,
        { reason: 'QR Code inválido', error: err.message },
        ip,
        userAgent,
      );
      throw new BadRequestException('QR Code inválido');
    }

    const registrationId = payload.sub;
    const eventId = payload.eventId;

    // 1. Antiduplicidade rápida no Redis
    const redisKey = `checkin:${registrationId}`;
    const cachedTime = await this.redisService.get(redisKey);
    if (cachedTime) {
      await this.auditLog.log(
        operatorId || null,
        'CHECKIN_FAILURE',
        'checkin',
        null,
        { registrationId, eventId, reason: 'Check-in já realizado (Redis cache)', cachedTime },
        ip,
        userAgent,
      );
      throw new ConflictException(`Check-in já realizado em ${cachedTime}`);
    }

    // 2. Buscar inscrição no banco de dados
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        checkIn: true,
        event: {
          select: { tenantId: true },
        },
      },
    });

    if (!registration) {
      await this.auditLog.log(
        operatorId || null,
        'CHECKIN_FAILURE',
        'checkin',
        null,
        { registrationId, eventId, reason: 'Inscrição não encontrada' },
        ip,
        userAgent,
      );
      throw new NotFoundException('Inscrição não encontrada');
    }

    // 3. Verificar status
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      await this.auditLog.log(
        operatorId || null,
        'CHECKIN_FAILURE',
        'checkin',
        null,
        { registrationId, eventId, reason: 'Inscrição não está confirmada', status: registration.status },
        ip,
        userAgent,
      );
      throw new UnprocessableEntityException('Inscrição não está confirmada');
    }

    // 4. Verificar duplicidade no banco
    if (registration.checkIn) {
      const checkedInAtStr = registration.checkIn.checkedInAt.toISOString();
      await this.redisService.set(redisKey, checkedInAtStr, 24 * 60 * 60);
      await this.auditLog.log(
        operatorId || null,
        'CHECKIN_FAILURE',
        'checkin',
        registration.checkIn.id,
        { registrationId, eventId, reason: 'Check-in já realizado (DB)' },
        ip,
        userAgent,
      );
      throw new ConflictException(`Check-in já realizado em ${checkedInAtStr}`);
    }

    const checkedInAt = new Date();
    let checkInId: string = '';

    // 5. Salvar no banco em transação
    await this.prisma.$transaction(async (tx) => {
      const checkin = await tx.checkIn.create({
        data: {
          registrationId,
          eventId,
          checkedInAt,
          operatorId,
          deviceId,
        },
      });
      checkInId = checkin.id;

      await tx.registration.update({
        where: { id: registrationId },
        data: { checkedInAt },
      });
    });

    // 6. Atualizar cache Redis
    await this.redisService.set(redisKey, checkedInAt.toISOString(), 24 * 60 * 60);

    // 7. Invalidar cache dashboard
    const tenantId = registration.event.tenantId;
    await this.redisService.del(`dashboard:overview:${tenantId}`);

    // 8. Emitir WebSocket
    this.checkInGateway.broadcastCheckIn(eventId, {
      registrationId,
      eventId,
      checkedInAt,
      name: registration.name,
      code: registration.code,
    });

    const totalCheckins = await this.prisma.checkIn.count({
      where: { eventId },
    });
    this.eventsGateway.emitToCheckIn(tenantId, eventId, {
      eventId,
      name: registration.name,
      checkedInAt,
      total: totalCheckins,
    });

    await this.auditLog.log(
      operatorId || null,
      'CHECKIN_SUCCESS',
      'checkin',
      checkInId,
      { registrationId, eventId, deviceId },
      ip,
      userAgent,
    );

    return {
      success: true,
      registration: {
        name: registration.name,
        code: registration.code,
        checkedInAt,
      },
    };
  }

  async syncOffline(
    checkins: Array<{ registrationId: string; eventId: string; checkedInAt: string; deviceId?: string; token?: string }>,
    operatorId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    let processed = 0;
    let duplicates = 0;
    const errors: Array<{ registrationId: string; error: string }> = [];

    const qrSecret = this.configService.get<string>('QR_SECRET') || 'super_secret_qr_signature_key_32_bytes_long_12345';

    for (const item of checkins) {
      try {
        let registrationId = item.registrationId;
        let eventId = item.eventId;

        // Se houver um token, opcionalmente validar a assinatura para segurança extra
        if (item.token) {
          try {
            const payload = this.jwtService.verify<QRCodePayload>(item.token, { secret: qrSecret });
            registrationId = payload.sub;
            eventId = payload.eventId;
          } catch (err: any) {
            await this.auditLog.log(
              operatorId || null,
              'CHECKIN_FAILURE',
              'checkin',
              null,
              { reason: 'QR Code inválido no sync', registrationId: item.registrationId, error: err.message },
              ip,
              userAgent,
            );
            errors.push({ registrationId: item.registrationId, error: 'QR Code inválido no sync' });
            continue;
          }
        }

        const redisKey = `checkin:${registrationId}`;
        const cachedTime = await this.redisService.get(redisKey);
        if (cachedTime) {
          await this.auditLog.log(
            operatorId || null,
            'CHECKIN_FAILURE',
            'checkin',
            null,
            { registrationId, eventId, reason: 'Check-in já realizado (Redis cache durante sync)', cachedTime },
            ip,
            userAgent,
          );
          duplicates++;
          continue;
        }

        const registration = await this.prisma.registration.findUnique({
          where: { id: registrationId },
          include: {
            checkIn: true,
            event: {
              select: { tenantId: true },
            },
          },
        });

        if (!registration) {
          await this.auditLog.log(
            operatorId || null,
            'CHECKIN_FAILURE',
            'checkin',
            null,
            { registrationId, eventId, reason: 'Inscrição não encontrada durante sync' },
            ip,
            userAgent,
          );
          errors.push({ registrationId, error: 'Inscrição não encontrada' });
          continue;
        }

        if (registration.status !== RegistrationStatus.CONFIRMED) {
          await this.auditLog.log(
            operatorId || null,
            'CHECKIN_FAILURE',
            'checkin',
            null,
            { registrationId, eventId, reason: 'Inscrição não está confirmada durante sync', status: registration.status },
            ip,
            userAgent,
          );
          errors.push({ registrationId, error: 'Inscrição não está confirmada' });
          continue;
        }

        if (registration.checkIn) {
          const checkedInAtStr = registration.checkIn.checkedInAt.toISOString();
          await this.redisService.set(redisKey, checkedInAtStr, 24 * 60 * 60);
          await this.auditLog.log(
            operatorId || null,
            'CHECKIN_FAILURE',
            'checkin',
            registration.checkIn.id,
            { registrationId, eventId, reason: 'Check-in já realizado (DB durante sync)' },
            ip,
            userAgent,
          );
          duplicates++;
          continue;
        }

        const checkedInAt = new Date(item.checkedInAt);
        let checkInId: string = '';

        await this.prisma.$transaction(async (tx) => {
          const checkin = await tx.checkIn.create({
            data: {
              registrationId,
              eventId,
              checkedInAt,
              operatorId,
              deviceId: item.deviceId,
              syncedAt: new Date(),
            },
          });
          checkInId = checkin.id;

          await tx.registration.update({
            where: { id: registrationId },
            data: { checkedInAt },
          });
        });

        await this.redisService.set(redisKey, checkedInAt.toISOString(), 24 * 60 * 60);

        const tenantId = registration.event.tenantId;
        await this.redisService.del(`dashboard:overview:${tenantId}`);

        this.checkInGateway.broadcastCheckIn(eventId, {
          registrationId,
          eventId,
          checkedInAt,
          name: registration.name,
          code: registration.code,
        });

        const totalCheckins = await this.prisma.checkIn.count({
          where: { eventId },
        });
        this.eventsGateway.emitToCheckIn(tenantId, eventId, {
          eventId,
          name: registration.name,
          checkedInAt,
          total: totalCheckins,
        });

        await this.auditLog.log(
          operatorId || null,
          'CHECKIN_SUCCESS',
          'checkin',
          checkInId,
          { registrationId, eventId, deviceId: item.deviceId, syncedOffline: true },
          ip,
          userAgent,
        );

        processed++;
      } catch (err: any) {
        this.logger.error(`Erro ao sincronizar check-in para inscrição ${item.registrationId}:`, err);
        await this.auditLog.log(
          operatorId || null,
          'CHECKIN_FAILURE',
          'checkin',
          null,
          { registrationId: item.registrationId, reason: 'Erro interno durante sync', error: err.message },
          ip,
          userAgent,
        );
        errors.push({ registrationId: item.registrationId, error: err.message || 'Erro interno' });
      }
    }

    return {
      processed,
      duplicates,
      errors,
    };
  }

  async getStats(eventId: string) {
    const totalConfirmed = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.CONFIRMED },
    });

    const checkedIn = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.CONFIRMED, checkIn: { isNot: null } },
    });

    const recentCheckins = await this.prisma.checkIn.findMany({
      where: { eventId },
      orderBy: { checkedInAt: 'desc' },
      take: 20,
      include: {
        registration: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    return {
      totalConfirmed,
      checkedIn,
      recentCheckins: recentCheckins.map((c) => ({
        registrationId: c.registrationId,
        checkedInAt: c.checkedInAt,
        name: c.registration?.name || 'Participante',
        code: c.registration?.code || '',
      })),
    };
  }
}
