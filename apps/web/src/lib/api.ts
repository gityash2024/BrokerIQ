'use client';
import { isApiErrorBody, privateMediaPath, type ApiErrorBody, type AuthResponse } from '@brokeriq/shared';
import { API_URL } from './utils';

const KEY = 'biq.auth';
const cacheResets = new Set<() => void>();
export function registerAuthCacheReset(reset: () => void) {
  cacheResets.add(reset);
  return () => {
    cacheResets.delete(reset);
  };
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
  get isNotConfigured() {
    return this.body.code === 'INTEGRATION_NOT_CONFIGURED';
  }
}

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: AuthResponse['user'];
  scopeRevision?: string;
}

export const authStore = {
  get(): StoredAuth | null {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(v: StoredAuth | null) {
    if (typeof window === 'undefined') return;
    const stored = authStore.get();
    const previous = stored?.user;
    const changed = !v || previous?.id !== v.user.id || previous?.role !== v.user.role || previous?.organization?.id !== v.user.organization?.id;
    if (changed) {
      guestEpoch++;
      cacheResets.forEach((reset) => reset());
    }
    // Preserve drafts. A fresh context nonce fences callbacks even across tabs and A → B → A.
    if (v) localStorage.setItem(KEY, JSON.stringify({ ...v, scopeRevision: !changed ? (stored?.scopeRevision ?? 'legacy') : crypto.randomUUID() }));
    else localStorage.removeItem(KEY);
    document.cookie = v ? `biq_role=${v.user.role}; path=/; max-age=31536000; samesite=lax` : 'biq_role=; path=/; max-age=0';
    window.dispatchEvent(new Event('biq-auth'));
  },
};

let guestEpoch = 0;
export class AccountScopeChangedError extends Error {}
export interface AccountContext {
  userId: string | undefined;
  scope: string;
  revision: string;
}
export function captureAccountContext(): AccountContext {
  const session = authStore.get(),
    user = session?.user;
  return {
    userId: user?.id,
    scope: user ? JSON.stringify([user.id, user.role, user.organization?.id ?? '']) : 'UNASSIGNED',
    revision: session?.scopeRevision ?? (user ? 'legacy' : `guest:${guestEpoch}`),
  };
}
export function assertAccountContext(context: AccountContext) {
  const current = captureAccountContext();
  if (current.userId !== context.userId || current.scope !== context.scope || current.revision !== context.revision)
    throw new AccountScopeChangedError('Account permissions changed. Reopen this screen.');
}
let refreshing: { revision: string; task: Promise<boolean> } | null = null;
async function refresh(): Promise<boolean> {
  const cur = authStore.get(),
    context = captureAccountContext();
  if (!cur?.refreshToken) return false;
  if (refreshing?.revision === context.revision) return refreshing.task;
  const task = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: cur.refreshToken }),
      });
      assertAccountContext(context);
      if (!res.ok) {
        if (res.status === 401 && authStore.get()?.refreshToken === cur.refreshToken) authStore.set(null);
        return false;
      }
      const data: AuthResponse = await res.json();
      assertAccountContext(context);
      if (authStore.get()?.refreshToken !== cur.refreshToken) return false;
      authStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      return true;
    } catch {
      return false;
    } finally {
      if (refreshing?.revision === context.revision) refreshing = null;
    }
  })();
  refreshing = { revision: context.revision, task };
  return task;
}
type Opts = Omit<RequestInit, 'body'> & { body?: unknown; auth?: boolean; raw?: boolean; ownerId?: string; ownerContext?: AccountContext };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { body, auth = true, raw, headers, ownerId, ownerContext, ...rest } = opts;
  const context = ownerContext ?? captureAccountContext();
  const assertOwner = () => {
    if (auth) {
      assertAccountContext(context);
      if (ownerId !== undefined && ownerId !== context.userId) throw new AccountScopeChangedError('Account permissions changed. Reopen this screen.');
    }
  };
  const send = async () => {
    assertOwner();
    const token = auth ? authStore.get()?.accessToken : undefined;
    return fetch(`${API_URL}/api${path}`, {
      ...rest,
      method: rest.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  };
  let res: Response;
  try {
    res = await send();
  } catch (error) {
    if (error instanceof AccountScopeChangedError) throw error;
    throw new ApiError(0, { statusCode: 0, code: 'INTERNAL', message: 'Server से connect नहीं हो पाया — internet check करें' });
  }
  assertOwner();
  if (res.status === 401 && auth && authStore.get()?.refreshToken && (await refresh())) res = await send();
  assertOwner();
  if (raw) return res as unknown as T;
  const text = await res.text();
  assertOwner();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const b: ApiErrorBody = isApiErrorBody(data) ? data : { statusCode: res.status, code: 'INTERNAL', message: res.statusText || 'Request failed' };
    throw new ApiError(res.status, b);
  }
  return data as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.body.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** Direct upload to Cloudinary / S3 using a server signature. Returns the public URL. */
export async function uploadFile(file: File | Blob, kind: string, onProgress?: (pct: number) => void): Promise<{ url: string; publicId?: string }> {
  const context = captureAccountContext();
  assertAccountContext(context);
  const contentType = (file as File).type || 'image/jpeg';
  const sig = await api<any>('/me/uploads/sign', { method: 'POST', body: { kind, contentType }, ownerContext: context });
  assertAccountContext(context);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error('Upload failed'));
    if (sig.provider === 'cloudinary') {
      const fd = new FormData();
      Object.entries(sig.fields as Record<string, string>).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      xhr.open('POST', sig.uploadUrl);
      xhr.onload = () => {
        try {
          assertAccountContext(context);
        } catch (error) {
          reject(error);
          return;
        }
        const r = safeJson(xhr.responseText);
        if (xhr.status >= 300 || !r?.secure_url) return reject(new Error(r?.error?.message ?? 'Upload failed'));
        resolve({ url: r.secure_url, publicId: r.public_id });
      };
      xhr.send(fd);
    } else {
      xhr.open('PUT', sig.uploadUrl);
      Object.entries(sig.headers ?? {}).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));
      xhr.onload = () => {
        try {
          assertAccountContext(context);
        } catch (error) {
          reject(error);
          return;
        }
        if (xhr.status < 300) resolve({ url: sig.publicUrl });
        else reject(new Error('Upload failed'));
      };
      xhr.send(file);
    }
  });
}

/** Compress an image in the browser before upload (keeps free storage quotas healthy). */
export async function compressImage(file: File, maxW = 1920, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
}

/** Authenticated binary reads for private source images and exports. */
export async function apiBlob(path: string): Promise<Blob> {
  // Exports use relative API paths; absolute binary URLs must belong to this API.
  const safePath = path.startsWith('/') && !path.startsWith('//') && !path.includes('://') ? path : privateMediaPath(path, API_URL);
  if (!safePath) throw new Error('Untrusted private media URL');
  const context = captureAccountContext();
  const assertOwner = () => {
    assertAccountContext(context);
    if (!context.userId) throw new AccountScopeChangedError('Sign in before opening a private document.');
  };
  const send = () => {
    assertOwner();
    return fetch(`${API_URL}/api${safePath}`, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: `Bearer ${authStore.get()?.accessToken ?? ''}` },
    });
  };
  let response = await send();
  assertOwner();
  if (response.status === 401 && (await refresh())) response = await send();
  assertOwner();
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Source could not be loaded' }));
    assertOwner();
    throw new ApiError(response.status, body);
  }
  const blob = await response.blob();
  assertOwner();
  return blob;
}
