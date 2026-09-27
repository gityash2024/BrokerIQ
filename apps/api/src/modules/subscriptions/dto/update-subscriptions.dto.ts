import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionsDto } from './create-subscriptions.dto';

export class UpdateSubscriptionsDto extends PartialType(CreateSubscriptionsDto) {}
