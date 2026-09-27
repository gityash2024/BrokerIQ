import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { PaymentStatus, PaymentProvider } from '@prisma/client';

export class CreatePaymentsDto {
  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsNotEmpty()
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsNotEmpty()
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
}
