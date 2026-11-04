import { request } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { API } from './fixtures';

export default async function globalSetup() {
  const { PrismaClient } = createRequire(resolve(__dirname, '../../api/package.json'))('@prisma/client');
  const db = new PrismaClient();
  try {
    // Minimal public HARERA snapshot used only in the isolated browser database.
    const project = {
      provider: 'HARERA',
      externalId: 'RERA-GRG-741-2020',
      name: '102 EDEN ESTATE',
      registrationNumber: 'GGM/415/147/2020/31 DATED 09.10.2020',
      sourceUrl: 'https://haryanarera.gov.in/view_project/searchprojectDetail/1444',
      sourceFetchedAt: new Date('2026-10-15T17:28:55.723Z'),
      sourceHash: '4d66518bf416cfc579e5defdcf71cf58f4b0ac87447c4fa2ee8b74a49236de73',
      metadata: {
        enrichment: {
          version: 1,
          sourceUrl: 'https://haryanarera.gov.in/view_project/project_preview_open/1444',
          fetchedAt: '2026-10-18T05:12:19.369454+00:00',
          sourceHash: '664db3f9ac5e6c9bfa92db5dfd03158ceb178187d92b59311601174a20d9c27b',
          facts: { landArea: '126.674 (Acre)' },
          tables: [],
          photos: [],
        },
      },
    };
    await db.areaDirectoryEntry.upsert({
      where: { provider_externalId: { provider: project.provider, externalId: project.externalId } },
      create: project,
      update: {},
    });
  } finally {
    await db.$disconnect();
  }
  const api = await request.newContext();
  try {
    const response = await api.post(API + '/auth/login', {
      data: { email: 'admin.web@e2e.test', password: 'Admin@12345' },
    });
    if (response.status() !== 200) throw new Error(`Isolated Admin login returned ${response.status()}`);
    const session = await response.json();
    if (session.user?.role !== 'SUPER_ADMIN' || !session.accessToken) throw new Error('Isolated Admin login returned an unexpected role');
    const deals = await api.patch(API + '/admin/modules/deals', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { state: 'ACTIVE', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] },
    });
    if (!deals.ok()) throw new Error(`Isolated Deals module setup returned ${deals.status()}`);
    process.env.BIQ_E2E_ADMIN_SESSION = JSON.stringify(session);
  } finally {
    await api.dispose();
  }
}
