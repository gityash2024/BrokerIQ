import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';
import { PropertyType, ListingType, PropertyStatus, FurnishingStatus } from '@prisma/client';

export class CreatePropertiesDto {
  @IsNotEmpty()
  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsNotEmpty()
  @IsEnum(ListingType)
  listingType!: ListingType;

  @IsNotEmpty()
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;

  @IsNotEmpty()
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsNumber()
  maintenanceCharges?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  bhk?: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  balconies?: number;

  @IsOptional()
  @IsNumber()
  superAreaSqFt?: number;

  @IsOptional()
  @IsNumber()
  carpetAreaSqFt?: number;

  @IsNotEmpty()
  @IsEnum(FurnishingStatus)
  furnishingStatus!: FurnishingStatus;

  @IsNotEmpty()
  @IsBoolean()
  parkingAvailable!: boolean;

  @IsOptional()
  @IsNumber()
  floorNumber?: number;

  @IsOptional()
  @IsNumber()
  totalFloors?: number;

  @IsOptional()
  @IsNumber()
  propertyAgeYears?: number;

  @IsOptional()
  @IsDateString()
  deletedAt?: Date;
}
