import { PartialType } from '@nestjs/swagger';
import { CreatePropertiesDto } from './create-properties.dto';

export class UpdatePropertiesDto extends PartialType(CreatePropertiesDto) {}
