import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'My Organization' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'my-org' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and dashes.',
  })
  slug!: string;
}
