import { Test } from '@nestjs/testing';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { env } from '../src/config/env';
import { CryptoService } from '../src/core/settings/crypto.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

it('offers a private APK while capture is paused and rejects tampered, expired and revoked download links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brokeriq-download-test-'));
  const app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
  const config = env();
  const previous = { CONNECT_APK_PATH: config.CONNECT_APK_PATH, CONNECT_APK_VERSION: config.CONNECT_APK_VERSION, CONNECT_ENABLED: config.CONNECT_ENABLED };
  try {
    config.CONNECT_APK_VERSION = 3;
    config.CONNECT_APK_PATH = join(root, 'BrokerIQ-Connect.apk');
    config.CONNECT_ENABLED = false;
    const fixture = Buffer.from('isolated APK transfer verification bytes');
    await writeFile(config.CONNECT_APK_PATH, fixture);
    configureApp(app);
    await app.init();
    const db = app.get(PrismaService);
    const user = await db.user.create({
      data: { role: 'USER', name: 'Download verification', email: `${Date.now()}-connect-download@e2e.test` },
      include: { organization: true },
    });
    const { accessToken } = await app.get(AuthService).issue(user);
    const http = () => request(app.getHttpServer());
    await http().get('/api/connect/profile').expect(401);
    const profile = await http().get('/api/connect/profile').set('Authorization', 'Bearer ' + accessToken).expect(200);
    expect(profile.body).toMatchObject({ enabled: false, latestVersion: 3 });
    expect(profile.headers['cache-control']).toBe('private, no-store');
    const path = new URL(profile.body.downloadUrl).pathname;
    const prefix = '/api/media/connect-apk/';
    expect(path.startsWith(prefix)).toBe(true);
    const firm = await db.organization.create({ data: { name: 'Connect download verification firm', slug: 'download-' + user.id } });
    const roles = ['BROKER_ADMIN', 'BROKER_AGENT', 'SUB_BROKER_ADMIN', 'PROPERTY_OWNER', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'] as const;
    for (const role of roles) {
      if (config.BROKER_FIRST && (role === 'MODERATOR' || role === 'SUPPORT')) continue;
      const account = await db.user.create({
        data: { role, organizationId: firm.id, name: 'Connect download check', email: `${user.id}-${role}@e2e.test` }, include: { organization: true },
      });
      const session = await app.get(AuthService).issue(account);
      const response = await http().get('/api/connect/profile').set('Authorization', 'Bearer ' + session.accessToken).expect(200);
      expect(new URL(response.body.downloadUrl).pathname.startsWith(prefix)).toBe(true);
    }
    const result = await http().get(path).expect(200).expect('Cache-Control', 'private, no-store');
    expect(result.headers['content-disposition']).toContain('BrokerIQ-Connect.apk');
    expect(result.headers['content-length']).toBe(String(fixture.length));
    await http().get(prefix + 'invalid-ticket').expect(404);
    const crypto = app.get(CryptoService);
    const ticket = JSON.parse(crypto.decrypt(decodeURIComponent(path.slice(prefix.length))));
    const expired = crypto.encrypt(JSON.stringify({ ...ticket, expiresAt: Date.now() - 1000 }));
    await http().get(prefix + encodeURIComponent(expired)).expect(404);
    await db.refreshToken.update({ where: { id: ticket.sessionId }, data: { revokedAt: new Date() } });
    await http().get(path).expect(404);
  } finally {
    Object.assign(config, previous);
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
