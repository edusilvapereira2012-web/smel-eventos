import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QrcodeService } from './qrcode.service';
import { Public } from '../auth/guards/public.decorator';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';

@ApiTags('QR Codes')
@Controller('registrations')
export class QrcodeController {
  constructor(private readonly qrcodeService: QrcodeService) {}

  @Get(':id/qrcode')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Busca ou gera a URL pública do QR Code PNG da inscrição' })
  @ApiResponse({ status: 200, description: 'URL obtida com sucesso' })
  async getQRCode(@Param('id') id: string) {
    const url = await this.qrcodeService.getOrCreateQRCode(id);
    return { url };
  }
}
