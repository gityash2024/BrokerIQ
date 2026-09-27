// apps/api/src/modules/properties/dto/scan-extract.dto.ts
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ScanExtractDto {
  @ApiPropertyOptional({
    description: 'Raw listing register text lines or OCR output to extract',
    example: 'Sec-86 | SS Omnia | G80 | GF Corner | 449 sqft | Ready Shop | Deepak | 9899248292',
  })
  @IsOptional()
  @IsString()
  rawText?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded image string of physical register page photo',
  })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiPropertyOptional({
    description: 'Pre-loaded sample register identifier for 1-tap demo testing',
    example: 'gurgaon-catalog-sample-1',
  })
  @IsOptional()
  @IsString()
  sampleId?: string;
}
