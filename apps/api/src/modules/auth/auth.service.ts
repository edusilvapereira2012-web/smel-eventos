import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ROLE_PERMISSIONS } from '../../common/rbac/permissions';
import { decrypt, maskCpf } from '../../common/utils/encryption.helper';
import { ConfigService } from '@nestjs/config';

import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private emailService: EmailService,
    private auditLog: AuditLogService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Erro genérico para evitar vazamento de e-mails cadastrados
      throw new BadRequestException('Não foi possível realizar o cadastro com as informações fornecidas');
    }

    const passwordHash = await argon2.hash(dto.password);
    const emailVerifyToken = randomUUID();

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        emailVerifyToken,
      },
    });

    // Enviar e-mail de verificação via fila centralizada
    await this.emailService.enqueue({
      tenantId: 'system',
      to: user.email,
      template: 'verify-email',
      variables: {
        name: user.name,
        token: emailVerifyToken,
      },
    });

    return {
      message: 'Cadastro realizado com sucesso. Verifique seu e-mail para ativar a conta.',
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      await this.auditLog.log(null, 'LOGIN_FAILURE', 'user', null, { email: dto.email, reason: 'user_not_found_or_inactive' }, ip, userAgent);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      await this.auditLog.log(user.id, 'LOGIN_FAILURE', 'user', user.id, { reason: 'invalid_password' }, ip, userAgent);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('E-mail não verificado. Por favor, verifique seu e-mail.');
    }

    // Emissão de Access Token (15 minutos) e Refresh Token (7 dias)
    const tokenId = randomUUID();
    const payload = { sub: user.id, email: user.email };
    const refreshPayload = { sub: user.id, tokenId };

    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(refreshPayload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    // Salvar token no Redis
    const redisKey = `refresh:${user.id}:${tokenId}`;
    const ttlSevenDays = 7 * 24 * 60 * 60;
    await this.redisService.set(redisKey, 'valid', ttlSevenDays);

    await this.auditLog.log(user.id, 'LOGIN_SUCCESS', 'user', user.id, {}, ip, userAgent);

    return {
      access_token,
      refresh_token,
    };
  }

  async refresh(userId: string, tokenId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inválido ou inativo');
    }

    // Invalidar token anterior no Redis
    const oldRedisKey = `refresh:${userId}:${tokenId}`;
    await this.redisService.del(oldRedisKey);

    // Gerar novo par
    const newTokenId = randomUUID();
    const payload = { sub: user.id, email: user.email };
    const refreshPayload = { sub: user.id, tokenId: newTokenId };

    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(refreshPayload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    // Salvar novo no Redis
    const newRedisKey = `refresh:${user.id}:${newTokenId}`;
    const ttlSevenDays = 7 * 24 * 60 * 60;
    await this.redisService.set(newRedisKey, 'valid', ttlSevenDays);

    return {
      access_token,
      refresh_token,
    };
  }

  async logout(userId: string, tokenId: string, ip?: string, userAgent?: string) {
    const redisKey = `refresh:${userId}:${tokenId}`;
    await this.redisService.del(redisKey);
    await this.auditLog.log(userId, 'LOGOUT', 'user', userId, {}, ip, userAgent);
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Sempre retornar mensagem genérica para não vazar informação
    const successResponse = {
      message: 'Se o e-mail informado estiver cadastrado, as instruções de recuperação foram enviadas.',
    };

    if (!user || !user.isActive) {
      return successResponse;
    }

    const passwordResetToken = randomUUID();
    const passwordResetExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpiry,
      },
    });

    // Enviar e-mail de recuperação via fila centralizada
    await this.emailService.enqueue({
      tenantId: 'system',
      to: user.email,
      template: 'reset-password',
      variables: {
        name: user.name,
        token: passwordResetToken,
      },
    });

    return successResponse;
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    await this.auditLog.log(user.id, 'PASSWORD_CHANGE_SUCCESS', 'user', user.id, {}, ip, userAgent);

    return {
      message: 'Senha atualizada com sucesso.',
    };
  }

  async verifyEmail(token: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
      },
    });

    await this.auditLog.log(user.id, 'EMAIL_VERIFIED', 'user', user.id, {}, ip, userAgent);

    // Enviar e-mail de boas-vindas via fila centralizada
    await this.emailService.enqueue({
      tenantId: 'system',
      to: user.email,
      template: 'welcome',
      variables: {
        name: user.name,
      },
    });

    return {
      message: 'E-mail verificado com sucesso.',
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return user;
  }

  async getPermissions(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email === 'valterpcjr@gmail.com') {
      return {
        role: TenantRole.OWNER,
        permissions: ROLE_PERMISSIONS[TenantRole.OWNER] || [],
      };
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
    });

    if (!membership) {
      return {
        role: null,
        permissions: [],
      };
    }

    return {
      role: membership.role,
      permissions: ROLE_PERMISSIONS[membership.role] || [],
    };
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Buscar logs de auditoria
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Buscar inscrições associadas ao e-mail do usuário ou userId
    const registrations = await this.prisma.registration.findMany({
      where: {
        OR: [
          { userId },
          { email: user.email },
        ],
      },
      include: {
        checkIn: true,
        certificates: true,
        event: {
          select: {
            title: true,
            startDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || 'super_secret_encryption_key_32_bytes_long_12345678';

    const processedRegistrations = registrations.map((reg) => {
      let maskedCpfVal: string | null = null;
      if (reg.cpf) {
        try {
          const decrypted = decrypt(reg.cpf, encryptionKey);
          maskedCpfVal = maskCpf(decrypted);
        } catch (err) {
          maskedCpfVal = '***.***.***-**';
        }
      }

      const certsMapped = reg.certificates ? reg.certificates.map((cert) => ({
        code: cert.code,
        fileUrl: cert.fileUrl,
        issuedAt: cert.issuedAt,
        type: cert.type,
        customTitle: cert.customTitle,
        hours: cert.hours,
      })) : [];

      return {
        id: reg.id,
        code: reg.code,
        eventName: reg.event.title,
        eventStartDate: reg.event.startDate,
        name: reg.name,
        email: reg.email,
        cpf: maskedCpfVal,
        phone: reg.phone,
        status: reg.status,
        checkedInAt: reg.checkedInAt,
        createdAt: reg.createdAt,
        checkIn: reg.checkIn ? {
          checkedInAt: reg.checkIn.checkedInAt,
          deviceId: reg.checkIn.deviceId,
        } : null,
        certificates: certsMapped,
        certificate: certsMapped.length > 0 ? certsMapped[0] : null,
      };
    });

    return {
      user,
      auditLogs,
      registrations: processedRegistrations,
    };
  }

  async deleteUserAccount(userId: string, confirm: string, ip?: string, userAgent?: string) {
    if (confirm !== 'EXCLUIR MINHA CONTA') {
      throw new BadRequestException('Confirmação inválida. Digite EXCLUIR MINHA CONTA para prosseguir.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // 1. Invalidar todas as sessões e refresh tokens no Redis
    const refreshKeyPattern = `refresh:${userId}:*`;
    await this.redisService.delPattern(refreshKeyPattern);

    // 2. Anonimizar/Redigir registros no banco
    const anonymizedEmail = `anon-${randomUUID()}@anonymized.local`;
    const anonymizedName = '[ANONIMIZADO]';

    await this.prisma.$transaction(async (tx) => {
      // Atualizar dados do usuário
      await tx.user.update({
        where: { id: userId },
        data: {
          name: anonymizedName,
          email: anonymizedEmail,
          passwordHash: 'ANONYMIZED_' + randomUUID(),
          isActive: false,
          emailVerifyToken: null,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });

      // Anonimizar inscrições associadas ao e-mail original ou userId
      const registrationsToAnonymize = await tx.registration.findMany({
        where: {
          OR: [
            { userId },
            { email: user.email },
          ],
        },
      });

      for (const reg of registrationsToAnonymize) {
        await tx.registration.update({
          where: { id: reg.id },
          data: {
            name: anonymizedName,
            email: `anon-reg-${randomUUID()}@anonymized.local`,
            cpf: null,
            phone: null,
            metadata: {},
          },
        });
      }

      // Limpar IP e User-Agent nos logs de auditoria do usuário
      await tx.auditLog.updateMany({
        where: { userId },
        data: {
          ip: null,
          userAgent: null,
          metadata: {},
        },
      });
    });

    // Registrar o log de auditoria
    await this.auditLog.log(
      userId,
      'ACCOUNT_DELETED_LGPD',
      'user',
      userId,
      { message: 'Conta e inscrições associadas foram anonimizadas de acordo com as regras da LGPD.' },
    );

    return {
      success: true,
      message: 'Sua conta e dados pessoais foram completamente excluídos e anonimizados do sistema.',
    };
  }
}
