import { PartialType } from '@nestjs/swagger';
import { CreateHousingDto } from './create-housing.dto';

export class UpdateHousingDto extends PartialType(CreateHousingDto) {}
