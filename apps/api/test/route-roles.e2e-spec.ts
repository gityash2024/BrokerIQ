import { Test } from '@nestjs/testing';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { IS_PUBLIC, ROLES_KEY } from '../src/common/decorators';
import { env } from '../src/config/env';

type Route = { method: string; path: string; public: boolean; roles?: Role[] };

/** Exercises the registered controller graph, not a manually maintained subset of URLs.
 * Only requests that metadata already forbids are sent; allowed mutations are never probed.
 * Independent namespace assertions catch missing/broadened role metadata in Admin/Broker APIs.
 * Record ownership and allowed-role workflows remain separate acceptance suites.
 */
describe('Every registered HTTP route: declared role denial', () => {
  let app: INestApplication;
  let routes: Route[];
  let db: PrismaService;
  let orgId: string;
  const tokens = new Map<Role, string>();
  const stamp = randomUUID();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    const org = await db.organization.create({ data: { name: 'Isolated route role audit', slug: 'route-roles-' + stamp } });
    orgId = org.id;
    const launchRoles = env().BROKER_FIRST ? [Role.SUPER_ADMIN, Role.BROKER_ADMIN, Role.BROKER_AGENT, Role.USER] : Object.values(Role);
    for (const role of launchRoles) {
      const user = await db.user.create({
        data: { name: role, email: `${role}.${stamp}@e2e.test`, role, organizationId: ['BROKER_ADMIN', 'BROKER_AGENT'].includes(role) ? org.id : null },
        include: { organization: true },
      });
      tokens.set(role, (await app.get(AuthService).issue(user)).accessToken);
    }
    const reflector = app.get(Reflector);
    routes = [];
    for (const module of app.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype;
        if (!controller || !wrapper.instance) continue;
        const prefix = reflector.get<string | string[]>(PATH_METADATA, controller) ?? '';
        const prototype = Object.getPrototypeOf(wrapper.instance);
        for (const key of Object.getOwnPropertyNames(prototype)) {
          const handler = Object.getOwnPropertyDescriptor(prototype, key)?.value;
          if (typeof handler !== 'function') continue;
          const method = reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
          if (method === undefined) continue;
          const path = reflector.get<string | string[]>(PATH_METADATA, handler) ?? '';
          for (const base of [prefix].flat())
            for (const leaf of [path].flat()) {
              routes.push({
                method: RequestMethod[method],
                path:
                  '/' +
                  [base, leaf]
                    .filter(Boolean)
                    .join('/')
                    .replace(/^\/+|\/+$/g, ''),
                public: !!reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, controller]),
                roles: reflector.getAllAndOverride<Role[]>(ROLES_KEY, [handler, controller]),
              });
            }
        }
      }
    }
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  it('requires explicit staff role boundaries on every Admin endpoint and excludes customer access to Broker endpoints', () => {
    const admin = routes.filter((route) => /^\/admin(?:\/|$)/.test(route.path));
    const broker = routes.filter((route) => /^\/broker(?:\/|$)/.test(route.path));
    expect(admin.length).toBeGreaterThan(30);
    expect(broker.length).toBeGreaterThan(10);
    // Existing installed clients use this historical export URL for their own firm's KYC.
    // It is the single reviewed namespace exception; the HTTP isolation case below fences it.
    const legacyExport = admin.filter((route) => route.method === 'GET' && route.path === '/admin/kyc/export');
    expect(legacyExport).toEqual([{ method: 'GET', path: '/admin/kyc/export', public: false, roles: ['SUPER_ADMIN', 'BROKER_ADMIN'] }]);
    expect(
      admin
        .filter((route) => route !== legacyExport[0])
        .filter((route) => route.public || !route.roles?.length || route.roles.some((role) => ['BROKER_ADMIN', 'BROKER_AGENT', 'USER'].includes(role))),
    ).toEqual([]);
    const onboarding = broker.filter((route) => route.method === 'POST' && route.path === '/broker/onboarding');
    expect(onboarding).toEqual([{ method: 'POST', path: '/broker/onboarding', public: false, roles: ['USER', 'BROKER_ADMIN'] }]);
    expect(broker.filter((route) => !route.public && route !== onboarding[0]).filter((route) => !route.roles?.length || route.roles.includes('USER'))).toEqual(
      [],
    );
  });

  it('keeps the legacy KYC export firm-scoped even when a Broker Admin requests a foreign firm and selected foreign IDs', async () => {
    const other = await db.organization.create({ data: { name: 'Isolated foreign KYC export', slug: 'route-kyc-other-' + stamp } });
    const own = await db.kycDocument.create({ data: { organizationId: orgId, docType: 'OTHER', fileUrl: '/private/not-fetched' } });
    const foreign = await db.kycDocument.create({ data: { organizationId: other.id, docType: 'OTHER', fileUrl: '/private/not-fetched' } });
    const http = () =>
      request(app.getHttpServer())
        .get('/api/admin/kyc/export')
        .set('Authorization', 'Bearer ' + tokens.get('BROKER_ADMIN'));
    const all = await http().query({ format: 'csv', brokerId: other.id }).expect(200);
    expect(all.text).toContain(own.id);
    expect(all.text).not.toContain(foreign.id);
    const selected = await http().query({ format: 'csv', brokerId: other.id, ids: foreign.id }).expect(200);
    expect(selected.text).not.toContain(foreign.id);
    await request(app.getHttpServer())
      .get('/api/admin/kyc')
      .set('Authorization', 'Bearer ' + tokens.get('BROKER_ADMIN'))
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/kyc/' + foreign.id)
      .set('Authorization', 'Bearer ' + tokens.get('BROKER_ADMIN'))
      .send({ status: 'VERIFIED' })
      .expect(403);
  });

  it('serves only the current firm’s directory fields to an Agent at the firm profile endpoint', async () => {
    const other = await db.organization.create({ data: { name: 'Isolated foreign profile', slug: 'route-profile-other-' + stamp } });
    const profile = (role: Role) =>
      request(app.getHttpServer()).get('/api/broker/profile').query({ organizationId: other.id }).auth(tokens.get(role)!, { type: 'bearer' });
    const agent = await profile('BROKER_AGENT').expect(200);
    expect(agent.body).toMatchObject({ id: orgId, name: 'Isolated route role audit' });
    expect(agent.headers['cache-control']).toBe('private, no-store');
    for (const privateField of [
      'webhookKey',
      'subscription',
      'plan',
      'usage',
      'invoicePrefix',
      'invoiceSeq',
      'upiId',
      'gstNumber',
      'blockedReason',
      'restrictions',
    ]) {
      expect(agent.body).not.toHaveProperty(privateField);
    }
    const admin = await profile('BROKER_ADMIN').expect(200);
    expect(admin.body).toMatchObject({ id: orgId, invoiceSeq: 0 });
    expect(admin.body).toHaveProperty('webhookKey');
    expect(admin.body).toHaveProperty('usage');
    await profile('USER').expect(403);
  });

  it('rejects every excluded role through the real JWT/session and role guards, without entering business handlers', async () => {
    let denied = 0;
    const failures: string[] = [];
    const guarded = routes.filter((route) => !route.public && route.roles?.length);
    let requestIndex = 0;
    for (const route of guarded) {
      const verb = route.method === 'ALL' ? 'get' : route.method.toLowerCase();
      if (!['get', 'post', 'patch', 'put', 'delete', 'head', 'options'].includes(verb)) throw new Error('Uncovered HTTP verb: ' + route.method);
      const url = '/api' + route.path.replace(/:[A-Za-z0-9_]+/g, 'route-audit-missing');
      for (const [role, token] of tokens) {
        // SUPER_ADMIN is deliberately granted the global override; service-specific checks remain separate.
        if (role === 'SUPER_ADMIN' || route.roles!.includes(role)) continue;
        // Independent client IPs preserve real rate limits on low-quota endpoints.
        // The test listener is loopback and configureApp enables the same trusted-proxy boundary.
        const ip = `192.0.${Math.floor(requestIndex / 250)}.${1 + (requestIndex++ % 250)}`;
        const result = await (request(app.getHttpServer()) as any)
          [verb](url)
          .set('Authorization', 'Bearer ' + token)
          .set('X-Forwarded-For', ip)
          .send({});
        if (result.status !== 403) failures.push(`${role}: ${route.method} ${route.path} returned ${result.status}`);
        denied++;
      }
    }
    expect(failures).toEqual([]);
    expect(denied).toBeGreaterThan(200);
    console.log(
      JSON.stringify({
        category: 'REGISTERED_ROUTE_ROLE_DENIAL',
        routes: routes.length,
        guardedRoutes: guarded.length,
        rejectedRoleRequests: denied,
        realNestAndPostgresql: true,
        recordOwnershipCoverage: 'SEPARATE_SUITES',
        stagingOrDeviceAcceptance: false,
      }),
    );
  }, 120_000);
});
