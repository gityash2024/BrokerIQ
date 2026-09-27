import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';

export class CreateAnalyticsDto {
  @IsNotEmpty()
  @IsNumber()
  count!: number;

  @IsNotEmpty()
  @IsDateString()
  periodStart!: Date;

  @IsNotEmpty()
  @IsDateString()
  periodEnd!: Date;
}
