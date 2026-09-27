import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsersDto } from './dto/create-users.dto';
import { UpdateUsersDto } from './dto/update-users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsersDto) {
    return this.prisma.user.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateUsersDto) {
    return this.prisma.user.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } as any });
  }
}
