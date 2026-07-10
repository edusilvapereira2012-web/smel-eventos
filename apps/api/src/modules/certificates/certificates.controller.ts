import { Controller, Post, Get, Param, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { Public } from '../auth/guards/public.decorator';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';

@ApiTags('Certificates')
@Controller()
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('events/:eventId/certificates/generate')
  @RequirePermission('events.update')
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Dispara geração em lote de certificados (BullMQ)' })
  @ApiResponse({ status: 202, description: 'Geração em lote iniciada' })
  @HttpCode(HttpStatus.ACCEPTED)
  async generateBatch(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.certificatesService.generateBatch(eventId, tenantId);
  }

  @Get('certificates/:code')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Busca detalhes de um certificado pelo código único' })
  @ApiResponse({ status: 200, description: 'Detalhes do certificado obtidos' })
  async getDetails(@Param('code') code: string) {
    return this.certificatesService.getCertificateDetails(code);
  }

  @Get('public/certificate/:code')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Validação pública de autenticidade do certificado' })
  @ApiResponse({ status: 200, description: 'Resultado da validação' })
  async validatePublic(@Param('code') code: string) {
    return this.certificatesService.findByCode(code);
  }

  @Get('registrations/:id/certificate')
  @RequirePermission('events.view')
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Retorna o certificado emitido para uma inscrição' })
  @ApiResponse({ status: 200, description: 'Certificado retornado com sucesso' })
  async getRegistrationCertificate(@Param('id') registrationId: string) {
    return this.certificatesService.getRegistrationCertificate(registrationId);
  }

  @Get('certificates/:code/download')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Incrementa o contador de downloads e redireciona para o PDF no MinIO' })
  @ApiResponse({ status: 302, description: 'Redirecionamento para o arquivo PDF' })
  async download(
    @Param('code') code: string,
    @Res() res: any,
  ) {
    const fileUrl = await this.certificatesService.downloadCertificate(code);
    return res.redirect(fileUrl);
  }
}
