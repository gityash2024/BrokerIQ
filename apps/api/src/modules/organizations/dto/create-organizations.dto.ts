import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { OrganizationStatus } from '@prisma/client';

export class CreateOrganizationsDto {
  @IsNotEmpty()
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;

  @IsNotEmpty()
  @IsNumber()
  maxBrokers!: number;

  @IsNotEmpty()
  @IsBoolean()
  isFounder!: boolean;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: Date;
}
