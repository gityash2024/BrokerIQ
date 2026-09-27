import { PartialType } from '@nestjs/swagger';
import { CreateFollowUpsDto } from './create-follow-ups.dto';

export class UpdateFollowUpsDto extends PartialType(CreateFollowUpsDto) {}
