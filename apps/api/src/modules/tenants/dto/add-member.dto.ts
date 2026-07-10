import { ApiProperty } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: TenantRole, default: TenantRole.MEMBER })
  @IsEnum(TenantRole)
  @IsNotEmpty()
  role!: TenantRole;
}
