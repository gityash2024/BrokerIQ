import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '@brokeriq/shared';

export class DemoLoginDto {
  @ApiProperty({
    enum: Role,
    description: 'Target persona to demo login as',
    example: Role.SUPER_ADMIN,
  })
  @IsEnum(Role)
  role!: Role;
}
