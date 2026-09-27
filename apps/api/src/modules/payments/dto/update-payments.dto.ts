import { PartialType } from '@nestjs/swagger';
import { CreatePaymentsDto } from './create-payments.dto';

export class UpdatePaymentsDto extends PartialType(CreatePaymentsDto) {}
