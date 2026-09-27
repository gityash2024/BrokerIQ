// apps/api/src/modules/properties/dto/market-directory-query.dto.ts
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarketDirectoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by sector code (e.g. 86, 88A, 89, 89A, 90, 91, 92, 93, mumbai-luxury)',
    example: '86',
  })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({
    description: 'Filter by category (Retail Shops, SCO Plots, Food Court Units, Pre-Leased Rented (ROI), Corporate Offices)',
    example: 'Retail Shops',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by floor (GF, FF, SF, Corner)',
    example: 'GF',
  })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({
    description: 'Search across title, project, unit number, sector, contact name, or phone number',
    example: 'SS Omnia',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
