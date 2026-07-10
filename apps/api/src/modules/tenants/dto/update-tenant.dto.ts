import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, IsInt, Min } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsString()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'CERTIFICADO DE PARTICIPAÇÃO' })
  @IsString()
  @IsOptional()
  certificateTitle?: string;

  @ApiPropertyOptional({ example: 'Certificamos que {NOME} participou...' })
  @IsString()
  @IsOptional()
  certificateBody?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsInt()
  @Min(1)
  @IsOptional()
  certificateHours?: number;

  @ApiPropertyOptional({ example: 'Organizador' })
  @IsString()
  @IsOptional()
  certificateSigner?: string;

  @ApiPropertyOptional({ example: 'https://example.com/signature.png' })
  @IsString()
  @IsOptional()
  certificateSignerUrl?: string;
}
