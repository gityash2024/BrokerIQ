import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCredentialsDto } from './dto/create-credentials.dto';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

@Injectable()
export class CredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCredentialsDto) { return 'This action adds a new Credentials'; }
  findAll() { return 'This action returns all Credentials'; }
  findOne(id: string) { return 'This action returns a #' + id + ' Credentials'; }
  update(id: string, dto: UpdateCredentialsDto) { return 'This action updates a #' + id + ' Credentials'; }
  remove(id: string) { return 'This action removes a #' + id + ' Credentials'; }
}
