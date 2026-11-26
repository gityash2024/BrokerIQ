import { defaultModulePolicies } from '@brokeriq/shared';
import * as configuration from '../../config/env';
import type { RequestUser } from '../../common/decorators';
import { researchGurugram, retrieveWorkspaceKnowledge } from './assistant-retrieval';

describe('Assistant retrieval', () => {
  const user: RequestUser = {
    id: 'delegate',
    email: 'delegate@e2e.test',
    role: 'BROKER_ADMIN',
    orgId: 'firm',
    delegatedActor: true,
    delegatedPermissions: ['assistant:view', 'inventory:view'],
  };

  afterEach(() => jest.restoreAllMocks());

  it('honors the current grants even if the optional vector index returns a stale unauthorized module', async () => {
    jest.spyOn(configuration, 'env').mockReturnValue({ ...configuration.env(), ASSISTANT_VECTOR_KNOWLEDGE_ENABLED: true });
    const outgoing = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ keys: ['organic_automation', 'inventory'] }));
    const guide = await retrieveWorkspaceKnowledge(user, defaultModulePolicies(), 'inventory organic', 1_000);
    expect(guide.map(({ key }) => key)).toEqual(['inventory']);
    const input = JSON.parse(String(outgoing.mock.calls[0][1]?.body));
    expect(input.documents.map(({ key }: { key: string }) => key)).toEqual(expect.arrayContaining(['inventory']));
    expect(input.documents.map(({ key }: { key: string }) => key)).not.toContain('organic_automation');
  });

  it('uses the module registry when the vector service is unavailable', async () => {
    jest.spyOn(configuration, 'env').mockReturnValue({ ...configuration.env(), ASSISTANT_VECTOR_KNOWLEDGE_ENABLED: true });
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('local index restarting'));
    await expect(retrieveWorkspaceKnowledge(user, defaultModulePolicies(), 'inventory', 1_000)).resolves.toMatchObject([{ key: 'inventory' }]);
  });

  it('searches only fixed public topics and returns allowlisted official links', async () => {
    const outgoing = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        results: [
          { url: 'https://gurugram.gov.in/document/sample?tracking=none', title: 'Notice', content: 'Public result' },
          { url: 'https://gurugram.gov.in.untrusted.invalid/page', title: 'Outside the domain' },
        ],
      }),
    );
    await expect(researchGurugram({ topic: 'registry', query: 'a client name' }, 1_000)).rejects.toThrow();
    expect(outgoing).not.toHaveBeenCalled();
    await expect(researchGurugram({ topic: 'registry', sector: 30 }, 1_000)).resolves.toEqual([
      { url: 'https://gurugram.gov.in/document/sample', title: 'Notice', excerpt: 'Public result' },
    ]);
    expect(String(outgoing.mock.calls[0][0])).toContain('http://127.0.0.1:18091/search');
  });
});
