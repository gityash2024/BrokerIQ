import { ImportsService } from './imports.service';

describe('approved chat AI drafts preserve source review and bounded work', () => {
  async function extract(rawText: string, available = true, fail = false) {
    const entries: any[] = [],
      updates: any[] = [];
    const batch = {
      id: 'batch',
      organizationId: 'firm',
      createdById: 'actor',
      status: 'QUEUED',
      sourceType: 'CHAT_EXPORT',
      rawText,
      metadata: {},
      groupName: 'Group',
    };
    const prisma = {
      organization: { findFirst: jest.fn(async () => ({ id: 'firm' })) },
      importBatch: {
        findUniqueOrThrow: jest.fn(async () => batch),
        update: jest.fn(async (value) => {
          updates.push(value);
        }),
      },
      sourceEntry: {
        upsert: jest.fn(async (value) => {
          entries.push(structuredClone(value.create));
        }),
        count: jest.fn(async () => 1),
      },
    };
    const ai = {
      isAvailable: jest.fn(async () => available),
      json: jest.fn(async () => {
        if (fail) throw new Error('Provider busy');
        return { entities: [{ kind: 'INVENTORY', inventory: { sector: 'Sector 45', purpose: 'RENT', monthlyRent: 30000 }, warnings: [] }] };
      }),
    };
    const service = new ImportsService(prisma as any, {} as any, { register: jest.fn() } as any, {} as any, {} as any, ai as any, {} as any);
    await service.extract('batch');
    return { entries, updates, ai };
  }
  it('reuses identical forwarded text without dropping the original sender/time or creating approved records', async () => {
    const text = '2 BHK for rent Sector 45 rent 30000';
    const { entries, updates, ai } = await extract(`13/11/2026, 10:00 - Sender: ${text}\n13/11/2026, 10:01 - Sender: ${text}`);
    expect(ai.json).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(2);
    expect(entries[0].rawText).toBe(text);
    expect(entries[0].ocr.sender).toBe('Sender');
    expect(entries[0].ocr.timestamp).not.toBe(entries[1].ocr.timestamp);
    expect(entries[0].extracted[0].warnings).toContain('AI draft. Verify against the original message.');
    expect(entries[0].reviewState).not.toBe('APPROVED');
    expect(updates.at(-1).data.metadata.textAi).toEqual({ available: true, requests: 1, draftMessages: 2, maxRequestsPerImport: 100 });
  });
  it('preserves every source after the request budget and still uses cached drafts for a later duplicate', async () => {
    const lines = Array.from({ length: 101 }, (_, i) => `13/11/2026, 10:00 - Sender: 2 BHK for rent Sector 45 rent 30000 note ${i}`);
    const { entries, ai, updates } = await extract([...lines, lines[0]].join('\n'));
    expect(entries).toHaveLength(102);
    expect(ai.json).toHaveBeenCalledTimes(100);
    expect(updates.at(-1).data.metadata.textAi.draftMessages).toBe(101);
  });
  it('falls back to source-backed rules after an outage or absent approval and never loses the original', async () => {
    const raw = '13/11/2026, 10:00 - Sender: 2 BHK for rent Sector 45 rent 30000';
    for (const [available, fail] of [
      [true, true],
      [false, false],
    ]) {
      const { entries, ai } = await extract(raw, available, fail);
      expect(entries).toHaveLength(1);
      expect(entries[0].rawText).toContain('Sector 45');
      expect(entries[0].extracted.some((item: any) => item.kind === 'INVENTORY')).toBe(true);
      expect(ai.json).toHaveBeenCalledTimes(available ? 1 : 0);
    }
  });
});
