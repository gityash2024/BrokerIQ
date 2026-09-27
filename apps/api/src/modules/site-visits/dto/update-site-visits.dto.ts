import { PartialType } from '@nestjs/swagger';
import { CreateSiteVisitsDto } from './create-site-visits.dto';

export class UpdateSiteVisitsDto extends PartialType(CreateSiteVisitsDto) {}
