import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { SystemSettingCategory } from '@prisma/client';

export class CreateSettingsDto {
  @IsNotEmpty()
  @IsEnum(SystemSettingCategory)
  group!: SystemSettingCategory;

  @IsNotEmpty()
  @IsObject()
  value!: any;

  @IsNotEmpty()
  @IsBoolean()
  isEncrypted!: boolean;
}
