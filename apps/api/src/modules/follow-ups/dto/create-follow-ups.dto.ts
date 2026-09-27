import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { FollowUpStatus, Priority, FollowUpType } from '@prisma/client';

export class CreateFollowUpsDto {
  @IsNotEmpty()
  @IsDateString()
  scheduledAt!: Date;

  @IsOptional()
  @IsDateString()
  reminderAt?: Date;

  @IsNotEmpty()
  @IsEnum(FollowUpStatus)
  status!: FollowUpStatus;

  @IsNotEmpty()
  @IsEnum(Priority)
  priority!: Priority;

  @IsNotEmpty()
  @IsEnum(FollowUpType)
  type!: FollowUpType;

  @IsOptional()
  @IsDateString()
  completedAt?: Date;

  @IsOptional()
  @IsDateString()
  deletedAt?: Date;
}
