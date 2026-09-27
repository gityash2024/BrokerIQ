import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { MessageDirection, MessageStatus } from '@prisma/client';

export class CreateWhatsappDto {
  @IsNotEmpty()
  @IsEnum(MessageDirection)
  direction!: MessageDirection;

  @IsNotEmpty()
  @IsEnum(MessageStatus)
  status!: MessageStatus;

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsNotEmpty()
  @IsDateString()
  sentAt!: Date;

  @IsOptional()
  @IsDateString()
  deliveredAt?: Date;

  @IsOptional()
  @IsDateString()
  readAt?: Date;
}
