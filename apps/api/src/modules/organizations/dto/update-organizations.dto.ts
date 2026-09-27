import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationsDto } from './create-organizations.dto';

export class UpdateOrganizationsDto extends PartialType(CreateOrganizationsDto) {}
