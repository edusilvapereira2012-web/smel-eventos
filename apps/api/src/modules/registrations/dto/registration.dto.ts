import { IsNotEmpty, IsEmail, IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RegistrationStatus } from '@prisma/client';

export class CreateRegistrationDto {
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @IsString()
  name!: string;

  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'E-mail em formato inválido.' })
  email!: string;

  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @IsString()
  cpf!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString({ each: true })
  workshopIds?: string[];
}

export class TransferRegistrationDto {
  @IsNotEmpty({ message: 'O nome do destinatário é obrigatório.' })
  @IsString()
  name!: string;

  @IsNotEmpty({ message: 'O e-mail do destinatário é obrigatório.' })
  @IsEmail({}, { message: 'E-mail do destinatário em formato inválido.' })
  email!: string;

  @IsNotEmpty({ message: 'O CPF do destinatário é obrigatório.' })
  @IsString()
  cpf!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ListRegistrationsQueryDto {
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
