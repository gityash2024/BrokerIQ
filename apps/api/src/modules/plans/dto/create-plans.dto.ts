import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class CreatePlansDto {
  @IsNotEmpty()
  @IsEnum(PlanTier)
  tier!: PlanTier;

  @IsNotEmpty()
  @IsNumber()
  priceMonthly!: number;

  @IsNotEmpty()
  @IsNumber()
  priceAnnual!: number;

  @IsNotEmpty()
  @IsNumber()
  trialDays!: number;

  @IsNotEmpty()
  @IsBoolean()
  isActive!: boolean;
}
