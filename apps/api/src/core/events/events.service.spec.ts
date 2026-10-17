import { EventsService } from './events.service';

it('waits for in-flight and chained handlers before shutdown completes', async () => {
  const events = new EventsService();
  const completed: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  events.on('lead.created', async ({ leadId, orgId }) => {
    await gate;
    completed.push('parent');
    events.emit('lead.updated', { leadId, orgId });
  });
  events.on('lead.updated', async () => {
    await Promise.resolve();
    completed.push('child');
  });
  events.emit('lead.created', { leadId: 'test-lead', orgId: 'test-org', isNew: true });
  let closed = false;
  const shutdown = events.onModuleDestroy().then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  release();
  await shutdown;
  expect(completed).toEqual(['parent', 'child']);
});
