import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUsersDto {
  @IsNotEmpty()
  @IsEnum(Role)
  role!: Role;

  @IsNotEmpty()
  @IsBoolean()
  isPhoneVerified!: boolean;

  @IsNotEmpty()
  @IsBoolean()
  isEmailVerified!: boolean;

  @IsOptional()
  @IsDateString()
  lastLoginAt?: Date;
}
