import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@brokeriq/shared';

export class SwitchRoleDto {
  @ApiProperty({
    enum: Role,
    description: 'Target role persona to activate',
    example: Role.PROPERTY_OWNER,
  })
  @IsEnum(Role)
  targetRole!: Role;

  @ApiPropertyOptional({
    description: 'Optional organization ID for broker roles',
    example: 'org_founder_001',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
