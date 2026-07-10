import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/registration.dto';
import { Public } from '../auth/guards/public.decorator';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStatus } from '@prisma/client';

@ApiTags('Public Registrations')
@Controller('public')
export class PublicRegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('events/:slug/register')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Inscrição pública em um evento publicado pelo slug' })
  @ApiResponse({ status: 201, description: 'Inscrição realizada com sucesso' })
  async publicRegister(
    @Param('slug') slug: string,
    @Body() dto: CreateRegistrationDto,
    @Req() req: any,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado ou não está publicado.');
    }

    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.registrationsService.create(event.id, dto, null, ip, userAgent);
  }

  @Get('registrations/:code/cancel')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Cancelamento público de inscrição por código + e-mail' })
  @ApiResponse({ status: 200, description: 'Inscrição cancelada com sucesso' })
  async publicCancel(
    @Param('code') code: string,
    @Query('email') email: string,
    @Query('reason') reason: string | undefined,
    @Req() req: any,
  ) {
    if (!email) {
      throw new BadRequestException('O e-mail é obrigatório para realizar o cancelamento.');
    }

    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.registrationsService.publicCancel(code, email, reason, ip, userAgent);
  }
}
