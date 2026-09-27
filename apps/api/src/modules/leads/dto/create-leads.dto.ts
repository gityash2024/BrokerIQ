import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { LeadStage, LeadSource, PropertyType } from '@prisma/client';

export class CreateLeadsDto {
  @IsNotEmpty()
  @IsEnum(LeadStage)
  stage!: LeadStage;

  @IsNotEmpty()
  @IsEnum(LeadSource)
  source!: LeadSource;

  @IsOptional()
  @IsNumber()
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  budgetMax?: number;

  @IsOptional()
  @IsEnum(PropertyType)
  preferredPropertyType?: PropertyType;

  @IsNotEmpty()
  @IsNumber()
  score!: number;

  @IsOptional()
  @IsNumber()
  wonAmount?: number;

  @IsOptional()
  @IsDateString()
  deletedAt?: Date;
}
