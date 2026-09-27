import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { AITaskType } from '@prisma/client';

export class CreateAiDto {
  @IsNotEmpty()
  @IsEnum(AITaskType)
  operationType!: AITaskType;

  @IsNotEmpty()
  @IsNumber()
  promptTokens!: number;

  @IsNotEmpty()
  @IsNumber()
  completionTokens!: number;

  @IsNotEmpty()
  @IsNumber()
  totalTokens!: number;

  @IsNotEmpty()
  @IsNumber()
  cost!: number;

  @IsNotEmpty()
  @IsNumber()
  executionDurationMs!: number;
}
