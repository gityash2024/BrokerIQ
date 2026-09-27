import { PartialType } from '@nestjs/swagger';
import { CreateLeadsDto } from './create-leads.dto';

export class UpdateLeadsDto extends PartialType(CreateLeadsDto) {}
