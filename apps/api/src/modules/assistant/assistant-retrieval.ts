import { hasDelegatedAccess, moduleAllowed, PLATFORM_MODULES, type ModulePolicies } from '@brokeriq/shared';
import { z } from 'zod';
import { env } from '../../config/env';
import type { RequestUser } from '../../common/decorators';

// The module registry is the source for product capabilities. CRM results always come from scoped APIs.
export async function retrieveWorkspaceKnowledge(user: RequestUser, policies: ModulePolicies, query: string, timeoutMs: number) {
  const actor = user.delegatedActor ? { ...user, role: 'SUB_BROKER_ADMIN' as const } : user;
  const role = actor.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : actor.role === 'PROPERTY_OWNER' ? 'USER' : actor.role;
  const search = new Set(query.toLowerCase().match(/[\p{L}\p{M}\p{N}]{3,}/gu) ?? []);
  const allowed = PLATFORM_MODULES.filter(
    ({ key }) => !['legacy', 'legacy_ai'].includes(key) && moduleAllowed(policies, key, role) && hasDelegatedAccess(actor, key, 'view'),
  ).map(({ key, name, description }) => ({ key, name, description }));
  const lexical = allowed
    .map(({ key, name, description }) => {
      const words = new Set((key + ' ' + name + ' ' + description).toLowerCase().match(/[\p{L}\p{M}\p{N}]{3,}/gu) ?? []);
      const score = [...search].filter((word) => words.has(word)).length;
      return { key, name, description, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, 6)
    .map(({ key, name, description }) => ({ key, name, description }));
  if (!env().ASSISTANT_VECTOR_KNOWLEDGE_ENABLED || !allowed.length || !query.trim() || timeoutMs < 1) return lexical;
  try {
    const response = await fetch('http://127.0.0.1:18092/rank', {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documents: allowed, lexical: lexical.map(({ key }) => key) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return lexical;
    const { keys } = z.object({ keys: z.array(z.string()).max(6) }).parse(await response.json());
    const documents = new Map(allowed.map((document) => [document.key, document]));
    const reranked = [...new Set(keys)].flatMap((key) => documents.get(key) ?? []);
    return reranked.length ? reranked : lexical;
  } catch {
    return lexical;
  }
}

const topics = {
  rental: 'residential property rental market',
  sale: 'residential property sale market',
  commercial: 'commercial office property market',
  registry: 'property registration land and RERA Haryana',
} as const;

const researchInput = z
  .object({
    topic: z.enum(['rental', 'sale', 'commercial', 'registry']),
    sector: z.number().int().min(1).max(115).optional(),
  })
  .strict();

const researchResult = z.object({
  results: z.array(z.object({ url: z.string(), title: z.string(), content: z.string().optional() })).max(100),
});
const trustedDomains = ['haryana.gov.in', 'haryanarera.gov.in', 'rera.gov.in', 'gurugram.gov.in', 'hsvphry.org.in', 'gmda.gov.in', 'data.gov.in', 'hbh.gov.in'];

export async function researchGurugram(input: unknown, timeoutMs: number) {
  const { topic, sector } = researchInput.parse(input);
  const search = new URL('http://127.0.0.1:18091/search');
  // Only server-owned public search phrases go to the index. Free-form user or CRM data stays in BrokerIQ.
  search.search = new URLSearchParams({
    q: 'Gurugram ' + (sector ? 'Sector ' + sector + ' ' : '') + topics[topic] + ' (' + trustedDomains.map((host) => 'site:' + host).join(' OR ') + ')',
    format: 'json',
    language: 'en',
    safesearch: '2',
  }).toString();
  const response = await fetch(search, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error('Public research is temporarily unavailable.');
  const { results } = researchResult.parse(await response.json());
  const seen = new Set<string>();
  return results
    .flatMap(({ url, title, content }) => {
      try {
        const link = new URL(url);
        if (
          link.protocol !== 'https:' ||
          link.username ||
          link.password ||
          link.port ||
          !trustedDomains.some((host) => link.hostname === host || link.hostname.endsWith('.' + host))
        )
          return [];
        link.search = '';
        link.hash = '';
        if (seen.has(link.href)) return [];
        seen.add(link.href);
        return [{ url: link.href, title: title.slice(0, 160), excerpt: content?.slice(0, 420) ?? '' }];
      } catch {
        return [];
      }
    })
    .slice(0, 6);
}
