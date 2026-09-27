import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStorageDto } from './dto/create-storage.dto';
import { UpdateStorageDto } from './dto/update-storage.dto';

@Injectable()
export class StorageService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateStorageDto) { return 'This action adds a new Storage'; }
  findAll() { return 'This action returns all Storage'; }
  findOne(id: string) { return 'This action returns a #' + id + ' Storage'; }
  update(id: string, dto: UpdateStorageDto) { return 'This action updates a #' + id + ' Storage'; }
  remove(id: string) { return 'This action removes a #' + id + ' Storage'; }
}
