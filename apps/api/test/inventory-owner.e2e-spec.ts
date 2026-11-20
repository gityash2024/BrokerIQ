import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Property Owner workspace', () => {
  let app: INestApplication;
  let db: PrismaService;
  let firmId: string;
  let adminId: string;
  let ownerId: string;
  let admin: string;
  let owner: string;
  let otherOwner: string;
  let external: string;
  let externalId: string;
  let agent: string;
  let agentId: string;
  let delegate: string;
  const stamp = randomUUID();
  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const properties = '/api/owner/properties';
  const listing = {
    sector: 'Sector 27',
    houseNo: 'QA-246',
    purpose: 'RENT',
    category: 'RESIDENTIAL',
    propertyType: 'BUILDER_FLOOR',
    roomKind: 'BHK',
    bhk: 3,
    floor: '3rd Floor',
    furnishing: 'SEMI_FURNISHED',
    area: 1250,
    areaUnit: 'SQ_FT',
    monthlyRent: 40000,
  };

  async function actor(name: string, role: Role, organizationId?: string, delegatedPermissions: string[] = []) {
    const user = await db.user.create({
      data: { name, role, organizationId, delegatedPermissions, email: name + '.' + stamp + '@e2e.test' },
      include: { organization: true },
    });
    return { user, token: (await app.get(AuthService).issue(user)).accessToken };
  }

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    firmId = (await db.organization.create({ data: { name: 'Owner flow test firm', slug: 'owner-' + stamp } })).id;
    const differentFirm = await db.organization.create({ data: { name: 'Separate owner test firm', slug: 'external-' + stamp } });
    const staff = await actor('admin', 'BROKER_ADMIN', firmId);
    adminId = staff.user.id;
    admin = staff.token;
    const anotherFirm = await actor('external', 'PROPERTY_OWNER', differentFirm.id);
    external = anotherFirm.token;
    externalId = anotherFirm.user.id;
    otherOwner = (await actor('other', 'PROPERTY_OWNER', firmId)).token;
    const assignee = await actor('agent', 'BROKER_AGENT', firmId);
    agent = assignee.token;
    agentId = assignee.user.id;
    delegate = (await actor('delegate', 'SUB_BROKER_ADMIN', firmId, ['inventory:view', 'inventory:edit', 'inventory:assign'])).token;
    const invited = await actor('invited', 'USER');
    ownerId = invited.user.id;
    const invitation = { email: invited.user.email, name: invited.user.name, role: 'PROPERTY_OWNER' };
    await api().post('/api/broker/team/invite').set(auth(delegate)).send(invitation).expect(403);
    const link = (await api().post('/api/broker/team/invite').set(auth(admin)).send(invitation).expect(201)).body.link;
    const accept = '/api/invites/' + link.split('/').at(-1) + '/accept';
    const accepted = (await api().post(accept).set(auth(invited.token)).send({}).expect(201)).body;
    expect(accepted.user.role).toBe('PROPERTY_OWNER');
    owner = accepted.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('limits owners to their own drafts and leaves broker inventory and assignment private', async () => {
    await api().get('/api/inventory').set(auth(owner)).expect(403);
    await api().get('/api/broker/team').set(auth(owner)).expect(403);
    await api().get(properties).set(auth(admin)).expect(403);
    await api()
      .post(properties)
      .set(auth(owner))
      .send({ ...listing, clientMutationId: randomUUID(), ownerUserId: externalId })
      .expect(400);
    await api()
      .post(properties)
      .set(auth(owner))
      .send({ ...listing, clientMutationId: randomUUID(), areaUnit: null })
      .expect(400);
    const payload = { ...listing, clientMutationId: randomUUID() };
    const create = () => api().post(properties).set(auth(owner)).send(payload).expect(201);
    const responses = await Promise.all([create(), create()]);
    const { id } = responses[0].body;
    expect(responses[1].body.id).toBe(id);
    expect(responses[0].body).toMatchObject({ houseNo: listing.houseNo, needsReview: true, availability: 'UNKNOWN' });
    for (const key of ['organizationId', 'assignedToId', 'ownerPhone', 'notes', 'contacts', 'createdById']) expect(responses[0].body).not.toHaveProperty(key);
    await api()
      .get(properties + '/' + id)
      .set(auth(otherOwner))
      .expect(404);
    await api()
      .get(properties + '/' + id)
      .set(auth(external))
      .expect(404);
    await api()
      .patch(properties + '/' + id)
      .set(auth(otherOwner))
      .send({ clientMutationId: randomUUID(), expectedRevision: 1, changes: { floor: '4th Floor' } })
      .expect(404);
    const firm = (
      await api()
        .get('/api/inventory/' + id)
        .set(auth(admin))
        .expect(200)
    ).body;
    expect(firm).toMatchObject({ status: 'DRAFT', assignedToId: null, verificationStatus: 'NEEDS_REVIEW' });
    expect(await db.notification.count({ where: { userId: adminId, title: 'New property from owner', link: '/broker/inventory/' + id } })).toBe(1);
    await api()
      .patch('/api/inventory/' + id + '/owner')
      .set(auth(admin))
      .send({ ownerUserId: externalId, expectedRevision: 1 })
      .expect(400);
    const team = (await api().get('/api/broker/team').set(auth(admin)).expect(200)).body;
    const withOwners = (await api().get('/api/broker/team?includeOwners=true').set(auth(admin)).expect(200)).body;
    expect(team.members.some((member: { id: string }) => member.id === ownerId)).toBe(false);
    expect(withOwners.members.some((member: { id: string }) => member.id === ownerId)).toBe(true);
  });

  it('allows a permitted delegate to link a property and review proposals, and keeps the owner status and date', async () => {
    const firmRecord = (
      await api()
        .post('/api/inventory')
        .set(auth(admin))
        .send({ ...listing, notes: 'Firm-private notes', assignedToId: agentId })
        .expect(201)
    ).body;
    const url = properties + '/' + firmRecord.id;
    const panel = '/api/inventory/' + firmRecord.id + '/owner';
    await api().get(url).set(auth(owner)).expect(404);
    await api().patch(panel).set(auth(agent)).send({ ownerUserId: ownerId, expectedRevision: firmRecord.revision }).expect(403);
    await api().patch(panel).set(auth(delegate)).send({ ownerUserId: ownerId, expectedRevision: firmRecord.revision }).expect(200);
    const linked = (await api().get(url).set(auth(owner)).expect(200)).body;
    expect(linked.notes).toBeUndefined();
    const report = { clientMutationId: randomUUID(), status: 'RENTED', availableFrom: '2027-03-01', note: 'Lease ends February' };
    await api()
      .post(url + '/update')
      .set(auth(owner))
      .send(report)
      .expect(201);
    await api()
      .post(url + '/update')
      .set(auth(owner))
      .send(report)
      .expect(201);
    await api()
      .post(url + '/update')
      .set(auth(otherOwner))
      .send(report)
      .expect(404);
    expect(await db.notification.count({ where: { userId: agentId, title: 'Property owner update', link: '/broker/inventory/' + firmRecord.id } })).toBe(1);
    const edit = { clientMutationId: randomUUID(), expectedRevision: linked.revision, changes: { floor: '4th Floor', monthlyRent: 45000 } };
    const proposal = (await api().patch(url).set(auth(owner)).send(edit).expect(200)).body;
    expect((await api().patch(url).set(auth(owner)).send(edit).expect(200)).body.id).toBe(proposal.id);
    const current = (await api().get(url).set(auth(owner)).expect(200)).body;
    expect(current.floor).toBe('3rd Floor');
    expect(current.pendingChanges.id).toBe(proposal.id);
    expect((await api().get(panel).set(auth(agent)).expect(200)).body.report).toMatchObject({ status: 'RENTED', availableFrom: '2027-03-01' });
    const review = { proposalId: proposal.id, expectedRevision: current.revision, accept: true };
    await api()
      .post(panel + '/review')
      .set(auth(agent))
      .send(review)
      .expect(403);
    await api()
      .post(panel + '/review')
      .set(auth(delegate))
      .send(review)
      .expect(201);
    await api()
      .post(panel + '/review')
      .set(auth(delegate))
      .send(review)
      .expect(409);
    const updated = (await api().get(url).set(auth(owner)).expect(200)).body;
    expect(updated).toMatchObject({ pendingChanges: null, floor: '4th Floor', monthlyRent: 45000, ownerReport: { status: 'RENTED' } });
    const stale = (
      await api()
        .patch(url)
        .set(auth(owner))
        .send({ ...edit, clientMutationId: randomUUID(), expectedRevision: updated.revision })
        .expect(200)
    ).body;
    const pending = (await api().get(url).set(auth(owner)).expect(200)).body;
    const staffEdit = (
      await api()
        .patch('/api/inventory/' + firmRecord.id)
        .set(auth(admin))
        .send({ expectedRevision: pending.revision, notes: 'Staff edit after owner proposal' })
        .expect(200)
    ).body;
    const late = { proposalId: stale.id, expectedRevision: staffEdit.revision, accept: true };
    await api()
      .post(panel + '/review')
      .set(auth(admin))
      .send(late)
      .expect(409);
    await api()
      .post(panel + '/review')
      .set(auth(admin))
      .send({ ...late, accept: false })
      .expect(201);
    await api()
      .patch(panel)
      .set(auth(admin))
      .send({ ownerUserId: null, expectedRevision: staffEdit.revision + 1 })
      .expect(200);
    await api().get(url).set(auth(owner)).expect(404);
    await api()
      .post(url + '/update')
      .set(auth(owner))
      .send(report)
      .expect(404);
  });
});
