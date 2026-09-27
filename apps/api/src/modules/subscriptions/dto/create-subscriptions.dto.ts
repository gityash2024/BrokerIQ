import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { SubscriptionStatus, BillingPeriod } from '@prisma/client';

export class CreateSubscriptionsDto {
  @IsNotEmpty()
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @IsNotEmpty()
  @IsEnum(BillingPeriod)
  billingInterval!: BillingPeriod;

  @IsNotEmpty()
  @IsDateString()
  currentPeriodStart!: Date;

  @IsNotEmpty()
  @IsDateString()
  currentPeriodEnd!: Date;

  @IsNotEmpty()
  @IsBoolean()
  cancelAtPeriodEnd!: boolean;

  @IsOptional()
  @IsDateString()
  trialStart?: Date;

  @IsOptional()
  @IsDateString()
  trialEnd?: Date;

  @IsOptional()
  @IsDateString()
  gracePeriodEndsAt?: Date;
}
