import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationsDto } from './dto/create-organizations.dto';
import { UpdateOrganizationsDto } from './dto/update-organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationsDto) {
    const slug = (dto as any).slug || (dto as any).name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.prisma.organization.create({
      data: {
        ...(dto as any),
        slug,
      },
    });
  }

  async findAll() {
    const orgs = await this.prisma.organization.findMany({
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            members: true,
            leads: true,
            properties: true,
            customers: true,
            siteVisits: true,
            followUps: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orgs.map((org) => {
      const activeSub = org.subscriptions[0];
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        logoUrl: org.logoUrl,
        isFounder: org.isFounder,
        maxBrokers: org.maxBrokers,
        trialEndsAt: org.trialEndsAt,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        plan: activeSub?.plan?.name || (org.isFounder ? 'FOUNDER' : 'FREE_TRIAL'),
        planTier: activeSub?.plan?.tier || 'FOUNDER',
        subscriptionStatus: activeSub?.status || 'TRIAL',
        brokersCount: org._count.members,
        leadsCount: org._count.leads,
        propertiesCount: org._count.properties,
        customersCount: org._count.customers,
        counts: org._count,
      };
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        },
        members: {
          include: { user: true },
        },
        featureFlags: true,
        integrations: true,
        _count: {
          select: {
            members: true,
            leads: true,
            properties: true,
            customers: true,
            siteVisits: true,
            followUps: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationsDto) {
    return this.prisma.organization.update({
      where: { id },
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}
