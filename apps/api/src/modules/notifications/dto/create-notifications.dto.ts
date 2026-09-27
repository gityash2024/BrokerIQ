import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationsDto {
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsNotEmpty()
  @IsBoolean()
  isRead!: boolean;

  @IsOptional()
  @IsObject()
  data?: any;
}
