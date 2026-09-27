import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { AuditAction } from '@prisma/client';

export class CreateAuditDto {
  @IsNotEmpty()
  @IsEnum(AuditAction)
  action!: AuditAction;

  @IsOptional()
  @IsObject()
  oldValues?: any;

  @IsOptional()
  @IsObject()
  newValues?: any;
}
