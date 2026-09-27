import { PartialType } from '@nestjs/swagger';
import { CreateCredentialsDto } from './create-credentials.dto';

export class UpdateCredentialsDto extends PartialType(CreateCredentialsDto) {}
