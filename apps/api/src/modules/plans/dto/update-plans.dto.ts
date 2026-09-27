import { PartialType } from '@nestjs/swagger';
import { CreatePlansDto } from './create-plans.dto';

export class UpdatePlansDto extends PartialType(CreatePlansDto) {}
