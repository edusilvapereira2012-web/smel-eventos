import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsArray,
} from 'class-validator';

// Categorias
export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

// Palestrantes
export class CreateSpeakerDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  role?: string;
}

export class UpdateSpeakerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  role?: string;
}

// Patrocinadores
export class CreateSponsorDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  tier?: string;
}

export class UpdateSponsorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  tier?: string;
}

// Programação (Schedule)
export class CreateScheduleItemDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsString()
  @IsOptional()
  speakerId?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class UpdateScheduleItemDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  speakerId?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}

export class ReorderScheduleDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
