import { ApiProperty } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateMemberDto {
  @ApiProperty({ enum: TenantRole })
  @IsEnum(TenantRole)
  @IsNotEmpty()
  role!: TenantRole;
}
