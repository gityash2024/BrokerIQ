import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList } from 'node:net';
import { DOMParser } from '@xmldom/xmldom';
import { organicRecordInput, type OrganicRecordInput } from '@brokeriq/shared';

const privateNetwork = new BlockList();
for (const [address, size] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateNetwork.addSubnet(address, size, 'ipv4');

export function sourceEndpoint(input: string) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Use an HTTPS source without embedded credentials on the standard port');
  }
  return url;
}

/** Resolve and pin a public address for this request. Redirects require a new approved endpoint. */
export async function readOrganicSource(input: string, etag?: string | null) {
  const url = sourceEndpoint(input);
  const addresses = await resolve4(url.hostname);
  if (!addresses.length || addresses.some((address) => privateNetwork.check(address))) throw new Error('Source is not on a public network');
  return new Promise<{ text: string | null; etag: string | null }>((resolve, reject) => {
    const req = request(url, {
      agent: false, family: 4, signal: AbortSignal.timeout(15_000),
      lookup: (_hostname, _options, callback) => callback(null, addresses[0], 4),
      headers: { 'User-Agent': 'BrokerIQ Organic Discovery', ...(etag ? { 'If-None-Match': etag } : {}) },
    }, (res) => {
      if (res.statusCode === 304) {
        res.resume();
        resolve({ text: null, etag: etag ?? null });
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('Source returned HTTP ' + res.statusCode));
        return;
      }
      const parts: Buffer[] = [];
      let size = 0;
      res.on('data', (part: Buffer) => {
        size += part.length;
        if (size > 3 * 1024 * 1024) {
          req.destroy(new Error('Source exceeded 3 MB'));
          return;
        }
        parts.push(part);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ text: Buffer.concat(parts).toString('utf8'), etag: res.headers.etag?.slice(0, 200) ?? null }));
    });
    req.on('error', reject);
    req.end();
  });
}

const string = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = (value: unknown) => {
  const text = string(value, 100);
  if (!text) return undefined;
  const result = new Date(text);
  return Number.isFinite(result.valueOf()) ? result.toISOString() : undefined;
};

function feedRows(input: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) throw new Error('Unsupported feed document declarations');
  const document = new DOMParser().parseFromString(input, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Source did not return a valid XML feed');
  const items = Array.from(document.getElementsByTagName('item'));
  return (items.length ? items : Array.from(document.getElementsByTagName('entry'))).slice(0, 500).map((item) => {
    const get = (tag: string) => item.getElementsByTagName(tag).item(0);
    return {
      id: get('guid')?.textContent ?? get('id')?.textContent,
      title: get('title')?.textContent,
      url: get('link')?.getAttribute('href') || get('link')?.textContent,
      description: get('description')?.textContent ?? get('summary')?.textContent ?? get('content')?.textContent,
      publishedAt: get('pubDate')?.textContent ?? get('published')?.textContent,
      updatedAt: get('updated')?.textContent,
    };
  });
}

function htmlRows(input: string) {
  return [...input.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)].slice(0, 100).flatMap((entry) => {
    try {
      const data = JSON.parse(entry[1]);
      return Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
    } catch { return []; }
  });
}

function registryProjects(input: string, baseUrl: string): OrganicRecordInput[] {
  const data = JSON.parse(input);
  if (!Array.isArray(data?.projects)) throw new Error('RERA project feed did not return a list');
  return data.projects.slice(0, 500).flatMap((row: Record<string, unknown> | null): OrganicRecordInput[] => {
    if (!row || row.state_code !== 'HR' || !/^(gurgaon|gurugram)$/i.test(string(row.district, 100))) return [];
    const title = string(row.name, 300);
    const reference = string(row.reg_no, 150);
    const href = string(row.url, 900);
    if (!title || !reference || !href) return [];
    let link: URL;
    try { link = new URL(href, baseUrl); } catch { return []; }
    if (link.origin !== 'https://reale.in' || !link.pathname.startsWith('/haryana/p/')) return [];
    const category = row.project_type === 'residential' ? 'RESIDENTIAL' : row.project_type === 'commercial' ? 'COMMERCIAL'
      : row.project_type === 'plotted' ? 'LAND' : undefined;
    const registered = string(row.registration_date, 10);
    const project = organicRecordInput.safeParse({
      kind: 'SUPPLY', title, url: link.href, externalId: reference, city: 'Gurugram', locality: string(row.locality, 300) || undefined,
      address: string(row.address, 300) || undefined, category, ownership: 'DEVELOPER', availability: 'UNKNOWN',
      registryReference: true, registryRegistration: reference, registryRegisteredAt: /^\d{4}-\d{2}-\d{2}$/.test(registered) ? registered : undefined,
      description: 'Project registration reference. Data: reale.in (CC BY 4.0).',
    });
    return project.success ? [project.data] : [];
  });
}

export function decodeOrganicSource(input: string, format: string, itemsPath: string, supports: string[], baseUrl: string) {
  if (format === 'RERA_PROJECTS') return registryProjects(input, baseUrl);
  let decoded: unknown;
  if (format === 'RSS') decoded = feedRows(input);
  else if (format === 'HTML') decoded = htmlRows(input);
  else {
    decoded = JSON.parse(input);
    for (const field of itemsPath.split('.').filter(Boolean)) {
      decoded = decoded && typeof decoded === 'object' && Object.hasOwn(decoded, field) ? (decoded as Record<string, unknown>)[field] : null;
    }
  }
  if (!Array.isArray(decoded)) throw new Error('Source items path did not return a list');

  return decoded.slice(0, 500).flatMap((raw): OrganicRecordInput[] => {
    if (!raw || typeof raw !== 'object') return [];
    const kind = typeof raw.kind === 'string' ? raw.kind.toUpperCase() : supports.length === 1 ? supports[0] : null;
    if (!kind || !supports.includes(kind)) return [];
    const title = string(raw.title ?? raw.headline ?? raw.name, 300);
    const sourceLink = string(raw.url ?? raw.link ?? raw.mainEntityOfPage, 900);
    if (!title || !sourceLink) return [];
    let link: URL;
    try { link = new URL(sourceLink, baseUrl); } catch { return []; }
    if (link.protocol !== 'https:' || link.username || link.password) return [];
    link.hash = '';
    const optional = {
      ...(raw.address && typeof raw.address === 'object' ? { address: raw.address.streetAddress, city: raw.city ?? raw.address.addressLocality } : {}),
      externalId: string(raw.externalId ?? raw.id ?? raw.identifier, 300) || undefined,
      publishedAt: date(raw.publishedAt ?? raw.datePublished),
      updatedAt: date(raw.updatedAt ?? raw.dateModified),
      description: string(typeof raw.description === 'string' ? raw.description.replace(/<[^>]{0,500}>/g, ' ') : '', 4000),
    };
    const base = { kind, title, url: link.href };
    const parsed = organicRecordInput.safeParse({ ...raw, ...optional, ...base, modelEvidence: undefined });
    if (parsed.success) return [parsed.data];
    // Keep common provenance when a provider includes an out-of-schema optional field.
    return [organicRecordInput.parse({ ...base, ...optional, address: undefined, city: undefined })];
  });
}
