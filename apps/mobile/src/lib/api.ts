import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { isApiErrorBody, type ApiErrorBody, type AuthResponse, type AuthUser } from '@brokeriq/shared';
import { create } from './store';
import { queryClient } from './query';
import { tr } from './i18n';

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  'https://brokeriqapi.mymultimeds.com/api'
).replace(/\/$/, '');
export const SOCKET_URL = API_URL.replace(/\/api$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
  get isNotConfigured() {
    return this.body.code === 'INTEGRATION_NOT_CONFIGURED';
  }
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
const KEY = 'biq.session';

export const useSession = create<{ session: Session | null; ready: boolean }>(() => ({ session: null, ready: false }));

let sessionRevision = 0;
let scopeEpoch = 0;
let sessionPersistence: Promise<void> = Promise.resolve();
const sessionResets = new Set<() => void | Promise<void>>();
export function registerSessionReset(reset: () => void | Promise<void>) {
  sessionResets.add(reset);
  return () => {
    sessionResets.delete(reset);
  };
}
export const authStore = {
  async load() {
    const revision = sessionRevision;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (revision !== sessionRevision) return;
      await authStore.set(raw ? JSON.parse(raw) : null);
      useSession.setState({ ready: true });
    } catch {
      if (revision === sessionRevision) useSession.setState({ session: null, ready: true });
    }
  },
  get: () => useSession.getState().session,
  async set(s: Session | null) {
    const revision = ++sessionRevision;
    const previous = authStore.get()?.user;
    const changed = previous?.id !== s?.user.id || previous?.role !== s?.user.role || previous?.organization?.id !== s?.user.organization?.id;
    if (changed) {
      scopeEpoch++;
      queryClient.clear();
    }
    useSession.setState({ session: s });
    if (changed) await Promise.allSettled([...sessionResets].map((reset) => Promise.resolve().then(reset)));
    sessionPersistence = sessionPersistence
      .catch(() => undefined)
      .then(async () => {
        if (revision !== sessionRevision) return;
        if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
        else await SecureStore.deleteItemAsync(KEY);
      });
    await sessionPersistence;
  },
};

export class AccountScopeChangedError extends Error {}
/** A serializable workspace key plus a process-local fence. Token rotation does not change this fence. */
export interface AccountContext {
  userId: string | undefined;
  scope: string;
  epoch: number;
}
export function accountScope(user = authStore.get()?.user): string {
  return user ? JSON.stringify([user.id, user.role, user.organization?.id ?? '']) : 'UNASSIGNED';
}
export function captureAccountContext(): AccountContext {
  return { userId: authStore.get()?.user.id, scope: accountScope(), epoch: scopeEpoch };
}
export function assertAccountContext(context: AccountContext) {
  if (context.epoch !== scopeEpoch || context.userId !== authStore.get()?.user.id || context.scope !== accountScope())
    throw new AccountScopeChangedError('Account permissions changed. Reopen this screen.');
}
let refreshing: { epoch: number; task: Promise<boolean> } | null = null;
async function refresh(): Promise<boolean> {
  const cur = authStore.get();
  const context = captureAccountContext();
  if (!cur?.refreshToken) return false;
  if (refreshing?.epoch === context.epoch) return refreshing.task;
  const task = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: cur.refreshToken }),
      });
      assertAccountContext(context);
      if (!res.ok) {
        if (res.status === 401 && authStore.get()?.refreshToken === cur.refreshToken) await authStore.set(null);
        return false;
      }
      const d: AuthResponse = await res.json();
      assertAccountContext(context);
      if (authStore.get()?.refreshToken !== cur.refreshToken) return false;
      await authStore.set({ accessToken: d.accessToken, refreshToken: d.refreshToken, user: d.user });
      return true;
    } catch {
      return false;
    } finally {
      if (refreshing?.epoch === context.epoch) refreshing = null;
    }
  })();
  refreshing = { epoch: context.epoch, task };
  return task;
}
type Opts = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  ownerId?: string;
  ownerContext?: AccountContext;
  responseType?: 'bytes';
};

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { body, auth = true, method = body === undefined ? 'GET' : 'POST', headers } = opts;
  const context = opts.ownerContext ?? captureAccountContext();
  const assertOwner = () => {
    if (auth) {
      assertAccountContext(context);
      if (opts.ownerId !== undefined && opts.ownerId !== context.userId) throw new AccountScopeChangedError('Account permissions changed. Reopen this screen.');
    }
  };
  const send = () => {
    assertOwner();
    const token = auth ? authStore.get()?.accessToken : undefined;
    return fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Client': 'app',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  let res: Response;
  try {
    res = await send();
  } catch (error) {
    if (error instanceof AccountScopeChangedError) throw error;
    throw new ApiError(0, { statusCode: 0, code: 'INTERNAL', message: 'Server से connect नहीं हो पाया — internet check करें' } as ApiErrorBody);
  }
  assertOwner();
  if (res.status === 401 && auth && authStore.get()?.refreshToken && (await refresh())) res = await send();
  assertOwner();
  if (res.ok && opts.responseType === 'bytes') {
    if (Number(res.headers.get('Content-Length')) > 20_000_000) throw new Error('Report is too large. Narrow the filters.');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assertOwner();
    if (bytes.byteLength > 20_000_000) throw new Error('Report is too large. Narrow the filters.');
    return bytes as T;
  }
  const text = await res.text();
  assertOwner();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok)
    throw new ApiError(res.status, isApiErrorBody(data) ? data : ({ statusCode: res.status, code: 'INTERNAL', message: 'Request failed' } as ApiErrorBody));
  return data as T;
}

export const post = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: 'POST', body });
export const patch = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: 'PATCH', body });
export const put = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: 'PUT', body });
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' });

/** User-facing error text in the chosen app language (API messages are in the i18n catalog). */
export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return tr(e.body.message);
  if (e instanceof Error) return tr(e.message);
  return tr('कुछ गड़बड़ हुई');
}

export const qs = (o: Record<string, unknown>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

/** Direct upload (Cloudinary / S3) of a local file uri via a server signature. */
export async function uploadUri(uri: string, kind: string, mime = 'image/jpeg'): Promise<{ url: string; publicId?: string }> {
  const context = captureAccountContext();
  const assertOwner = () => {
    assertAccountContext(context);
    if (!context.userId) throw new AccountScopeChangedError('Sign in before uploading.');
  };
  assertOwner();
  const sig = await api<any>('/me/uploads/sign', { body: { kind, contentType: mime }, ownerContext: context });
  assertOwner();
  if (sig.provider === 'cloudinary') {
    const fd = new FormData();
    Object.entries(sig.fields as Record<string, string>).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', { uri, name: `upload.${mime.split('/')[1] ?? 'jpg'}`, type: mime } as any);
    const r = await fetch(sig.uploadUrl, { method: 'POST', body: fd });
    const j = await r.json();
    assertOwner();
    if (!r.ok || !j.secure_url) throw new Error(j?.error?.message ?? 'Upload failed');
    return { url: j.secure_url, publicId: j.public_id };
  }
  const blob = await (await fetch(uri)).blob();
  assertOwner();
  const r = await fetch(sig.uploadUrl, { method: 'PUT', headers: sig.headers ?? { 'Content-Type': mime }, body: blob });
  if (!r.ok) throw new Error('Upload failed');
  assertOwner();
  return { url: sig.publicUrl };
}

/** On-the-fly resize for Cloudinary and self-hosted (/api/media) URLs; other URLs untouched. */
export function img(url?: string | null, w = 800) {
  if (!url) return undefined;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/c_'))
    return url.replace('/upload/', `/upload/c_limit,w_${w},q_auto,f_auto/`);
  if (url.includes('/api/media/f/') && !url.includes('?')) {
    const width = [320, 480, 800, 1200].find((x) => x >= w);
    return width ? `${url}?w=${width}` : url;
  }
  return url;
}
