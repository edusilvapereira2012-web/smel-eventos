import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateQRCodeDto {
  @ApiProperty({ description: 'Token JWT contido no QR Code' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'ID opcional do dispositivo do operador', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class OfflineCheckInDto {
  @ApiProperty({ description: 'ID da Inscrição' })
  @IsString()
  @IsNotEmpty()
  registrationId!: string;

  @ApiProperty({ description: 'ID do Evento' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ description: 'Data/Hora em que o check-in ocorreu offline' })
  @IsDateString()
  @IsNotEmpty()
  checkedInAt!: string;

  @ApiProperty({ description: 'ID opcional do dispositivo do operador', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ description: 'Token opcional para autenticidade extra', required: false })
  @IsString()
  @IsOptional()
  token?: string;
}

export class SyncOfflineCheckInsDto {
  @ApiProperty({ description: 'Lista de check-ins offline para sincronização', type: [OfflineCheckInDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineCheckInDto)
  checkins!: OfflineCheckInDto[];
}
