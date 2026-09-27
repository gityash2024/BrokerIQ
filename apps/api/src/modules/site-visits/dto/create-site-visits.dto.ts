import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { SiteVisitStatus } from '@prisma/client';

export class CreateSiteVisitsDto {
  @IsNotEmpty()
  @IsDateString()
  scheduledAt!: Date;

  @IsNotEmpty()
  @IsEnum(SiteVisitStatus)
  status!: SiteVisitStatus;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsDateString()
  completedAt?: Date;

  @IsOptional()
  @IsDateString()
  deletedAt?: Date;
}
