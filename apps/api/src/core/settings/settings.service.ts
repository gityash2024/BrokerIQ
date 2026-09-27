import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  appConfigSchema,
  DEFAULT_APP_CONFIG,
  INTEGRATIONS,
  getIntegration,
  type AppConfig,
  type IntegrationDef,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from './crypto.service';
import { IntegrationNotConfiguredException } from '../../common/exceptions';

type StoredValue = string | number | boolean | { enc: string } | null;
interface StoredIntegration {
  enabled: boolean;
  fields: Record<string, StoredValue>;
}
export type IntegrationValues = Record<string, string | number | boolean | undefined>;

const MASK = '••••••••';
const TTL_MS = 30_000;
const APP_CONFIG_KEY = 'app.config';
const integrationKey = (key: string) => `integration.${key}`;

/**
 * Credentials Center + dynamic app settings.
 * Resolution order for a credential: organization setting → platform setting → env (INTEGRATION_<KEY>_<FIELD>).
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ------------------------------------------------------------------ cache helpers
  private cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value as T);
    return loader().then((value) => {
      this.cache.set(key, { at: Date.now(), value });
      return value;
    });
  }
  invalidate(prefix?: string) {
    if (!prefix) return this.cache.clear();
    for (const k of this.cache.keys()) if (k.startsWith(prefix)) this.cache.delete(k);
  }

  // ------------------------------------------------------------------ raw json settings
  async getJson<T = unknown>(key: string): Promise<T | null> {
    return this.cached(`sys:${key}`, async () => {
      const row = await this.prisma.systemSetting.findUnique({ where: { key } });
      return (row?.value as T) ?? null;
    });
  }

  async setJson(key: string, value: unknown, userId?: string) {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: userId },
      update: { value: value as Prisma.InputJsonValue, updatedById: userId },
    });
    this.invalidate(`sys:${key}`);
  }

  // ------------------------------------------------------------------ app config
  async getAppConfig(): Promise<AppConfig> {
    const stored = await this.getJson<Partial<AppConfig>>(APP_CONFIG_KEY);
    const parsed = appConfigSchema.safeParse(stored ?? {});
    return parsed.success ? parsed.data : DEFAULT_APP_CONFIG;
  }

  async updateAppConfig(patch: Partial<AppConfig>, userId?: string): Promise<AppConfig> {
    const current = await this.getAppConfig();
    const merged = deepMerge(current, patch);
    const parsed = appConfigSchema.safeParse(merged);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    await this.setJson(APP_CONFIG_KEY, parsed.data, userId);
    return parsed.data;
  }

  // ------------------------------------------------------------------ integrations
  private defOrThrow(key: string): IntegrationDef {
    const def = getIntegration(key);
    if (!def) throw new BadRequestException(`Unknown integration: ${key}`);
    return def;
  }

  private async loadStored(key: string, orgId?: string | null): Promise<{ stored: StoredIntegration | null; meta: any }> {
    const def = this.defOrThrow(key);
    if (def.scope === 'organization') {
      if (!orgId) return { stored: null, meta: null };
      return this.cached(`org:${orgId}:${key}`, async () => {
        const row = await this.prisma.orgSetting.findUnique({ where: { organizationId_key: { organizationId: orgId, key: integrationKey(key) } } });
        return { stored: (row?.value as unknown as StoredIntegration) ?? null, meta: row };
      });
    }
    return this.cached(`sys:${integrationKey(key)}:meta`, async () => {
      const row = await this.prisma.systemSetting.findUnique({ where: { key: integrationKey(key) } });
      return { stored: (row?.value as unknown as StoredIntegration) ?? null, meta: row };
    });
  }

  private decode(stored: StoredIntegration | null): IntegrationValues {
    const out: IntegrationValues = {};
    if (!stored?.fields) return out;
    for (const [k, v] of Object.entries(stored.fields)) {
      if (v && typeof v === 'object' && 'enc' in v) {
        try {
          out[k] = this.crypto.decrypt(v.enc);
        } catch {
          this.logger.warn(`Could not decrypt field ${k} — was ENCRYPTION_MASTER_KEY changed?`);
        }
      } else if (v !== null && v !== undefined && v !== '') out[k] = v;
    }
    return out;
  }

  private envValues(def: IntegrationDef): IntegrationValues {
    const out: IntegrationValues = {};
    for (const f of def.fields) {
      const v = process.env[`INTEGRATION_${def.key.toUpperCase()}_${f.key.toUpperCase()}`];
      if (v !== undefined && v !== '') out[f.key] = f.type === 'number' ? Number(v) : f.type === 'boolean' ? v === 'true' : v;
    }
    return out;
  }

  private withDefaults(def: IntegrationDef, values: IntegrationValues): IntegrationValues {
    const out = { ...values };
    for (const f of def.fields) if (out[f.key] === undefined && f.default !== undefined) out[f.key] = f.default;
    return out;
  }

  isComplete(def: IntegrationDef, values: IntegrationValues): boolean {
    return def.fields.filter((f) => f.required).every((f) => values[f.key] !== undefined && values[f.key] !== '');
  }

  /** Decrypted values for the integration in its own scope (or null when not configured / disabled). */
  async resolve(key: string, orgId?: string | null): Promise<IntegrationValues | null> {
    const def = this.defOrThrow(key);
    const { stored } = await this.loadStored(key, orgId);
    if (stored && stored.enabled === false) return null;
    let values = this.decode(stored);
    if (def.scope === 'platform' && !this.isComplete(def, values)) values = { ...this.envValues(def), ...values };
    values = this.withDefaults(def, values);
    return this.isComplete(def, values) ? values : null;
  }

  /** Like resolve() but throws INTEGRATION_NOT_CONFIGURED when missing. */
  async require(key: string, orgId?: string | null, message?: string): Promise<IntegrationValues> {
    const values = await this.resolve(key, orgId);
    if (!values) throw new IntegrationNotConfiguredException(key, message);
    return values;
  }

  async isConfigured(key: string, orgId?: string | null) {
    return !!(await this.resolve(key, orgId));
  }

  /** View for the settings UI — secrets masked. */
  async view(key: string, orgId?: string | null) {
    const def = this.defOrThrow(key);
    const { stored, meta } = await this.loadStored(key, orgId);
    const values = this.decode(stored);
    const fields: Record<string, unknown> = {};
    for (const f of def.fields) {
      const v = values[f.key];
      if (f.secret) fields[f.key] = v ? `${MASK}${String(v).slice(-4)}` : '';
      else fields[f.key] = v ?? f.default ?? '';
    }
    const resolved = await this.resolve(key, orgId);
    return {
      key,
      enabled: stored?.enabled ?? true,
      configured: !!resolved,
      source: stored && this.isComplete(def, this.withDefaults(def, values)) ? 'database' : resolved ? 'env' : 'none',
      fields,
      lastTestedAt: meta?.lastTestedAt ?? null,
      lastTestOk: meta?.lastTestOk ?? null,
      lastTestMessage: meta?.lastTestMessage ?? null,
      updatedAt: meta?.updatedAt ?? null,
    };
  }

  async save(key: string, input: { enabled?: boolean; fields: Record<string, unknown> }, opts: { orgId?: string | null; userId?: string }) {
    const def = this.defOrThrow(key);
    if (def.scope === 'organization' && !opts.orgId) throw new BadRequestException('Organization required');
    const { stored } = await this.loadStored(key, opts.orgId);
    const existing = stored?.fields ?? {};
    const next: Record<string, StoredValue> = {};

    for (const f of def.fields) {
      const raw = input.fields?.[f.key];
      if (f.secret) {
        const str = raw == null ? '' : String(raw);
        if (!str || str.startsWith(MASK)) {
          if (existing[f.key]) next[f.key] = existing[f.key];
          continue;
        }
        next[f.key] = { enc: this.crypto.encrypt(str.trim()) };
        continue;
      }
      if (raw === undefined || raw === null || raw === '') continue;
      if (f.type === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new BadRequestException(`${f.label} must be a number`);
        next[f.key] = n;
      } else if (f.type === 'boolean') next[f.key] = raw === true || raw === 'true';
      else next[f.key] = String(raw).trim();
    }

    const value: StoredIntegration = { enabled: input.enabled ?? stored?.enabled ?? true, fields: next };
    if (def.scope === 'organization') {
      await this.prisma.orgSetting.upsert({
        where: { organizationId_key: { organizationId: opts.orgId!, key: integrationKey(key) } },
        create: { organizationId: opts.orgId!, key: integrationKey(key), value: value as unknown as Prisma.InputJsonValue, updatedById: opts.userId },
        update: { value: value as unknown as Prisma.InputJsonValue, updatedById: opts.userId },
      });
      this.invalidate(`org:${opts.orgId}:${key}`);
    } else {
      await this.prisma.systemSetting.upsert({
        where: { key: integrationKey(key) },
        create: { key: integrationKey(key), value: value as unknown as Prisma.InputJsonValue, updatedById: opts.userId },
        update: { value: value as unknown as Prisma.InputJsonValue, updatedById: opts.userId },
      });
      this.invalidate(`sys:${integrationKey(key)}`);
    }
    return this.view(key, opts.orgId);
  }

  async remove(key: string, orgId?: string | null) {
    const def = this.defOrThrow(key);
    if (def.scope === 'organization') {
      await this.prisma.orgSetting.deleteMany({ where: { organizationId: orgId!, key: integrationKey(key) } });
      this.invalidate(`org:${orgId}:${key}`);
    } else {
      await this.prisma.systemSetting.deleteMany({ where: { key: integrationKey(key) } });
      this.invalidate(`sys:${integrationKey(key)}`);
    }
  }

  async recordTest(key: string, orgId: string | null | undefined, ok: boolean, message: string) {
    const def = this.defOrThrow(key);
    const data = { lastTestedAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 500) };
    if (def.scope === 'organization') {
      await this.prisma.orgSetting.updateMany({ where: { organizationId: orgId!, key: integrationKey(key) }, data });
      this.invalidate(`org:${orgId}:${key}`);
    } else {
      await this.prisma.systemSetting.updateMany({ where: { key: integrationKey(key) }, data });
      this.invalidate(`sys:${integrationKey(key)}`);
    }
  }

  /** Platform integrations status overview for the admin dashboard. */
  async platformOverview() {
    return Promise.all(INTEGRATIONS.filter((i) => i.scope === 'platform').map((i) => this.view(i.key)));
  }

  /** Public, non-secret values safe to ship to clients. */
  async publicIntegrations() {
    const out: Record<string, Record<string, unknown> & { configured: boolean }> = {};
    for (const def of INTEGRATIONS.filter((i) => i.scope === 'platform')) {
      const values = await this.resolve(def.key);
      const pub: Record<string, unknown> & { configured: boolean } = { configured: !!values };
      if (values) for (const f of def.fields.filter((x) => x.public)) pub[f.key] = values[f.key];
      out[def.key] = pub;
    }
    return out;
  }
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return (patch ?? base) as T;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? deepMerge(out[k], v) : v;
  }
  return out;
}
