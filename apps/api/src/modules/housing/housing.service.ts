import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';

@Injectable()
export class HousingService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHousingDto) { return 'This action adds a new Housing'; }
  findAll() { return 'This action returns all Housing'; }
  findOne(id: string) { return 'This action returns a #' + id + ' Housing'; }
  update(id: string, dto: UpdateHousingDto) { return 'This action updates a #' + id + ' Housing'; }
  remove(id: string) { return 'This action removes a #' + id + ' Housing'; }
}
