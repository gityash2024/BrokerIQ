import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { AutomationTrigger } from '@prisma/client';

export class CreateAutomationDto {
  @IsNotEmpty()
  @IsEnum(AutomationTrigger)
  triggerType!: AutomationTrigger;

  @IsNotEmpty()
  @IsObject()
  conditions!: any;

  @IsNotEmpty()
  @IsObject()
  actions!: any;

  @IsNotEmpty()
  @IsNumber()
  delayMinutes!: number;

  @IsNotEmpty()
  @IsBoolean()
  isBusinessHoursOnly!: boolean;

  @IsNotEmpty()
  @IsBoolean()
  isActive!: boolean;
}
