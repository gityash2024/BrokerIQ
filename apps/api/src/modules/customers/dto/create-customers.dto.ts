import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';

export class CreateCustomersDto {
  @IsOptional()
  @IsDateString()
  deletedAt?: Date;
}
