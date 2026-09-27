'use client';
import { isApiErrorBody, type ApiErrorBody, type AuthResponse } from '@brokeriq/shared';
import { API_URL } from './utils';

const KEY = 'biq.auth';

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
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
    document.cookie = v ? `biq_role=${v.user.role}; path=/; max-age=2592000; samesite=lax` : 'biq_role=; path=/; max-age=0';
    window.dispatchEvent(new Event('biq-auth'));
  },
};

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  const cur = authStore.get();
  if (!cur?.refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: cur.refreshToken }) });
      if (!res.ok) {
        authStore.set(null);
        return false;
      }
      const data: AuthResponse = await res.json();
      authStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Opts = Omit<RequestInit, 'body'> & { body?: unknown; auth?: boolean; raw?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { body, auth = true, raw, headers, ...rest } = opts;
  const send = async () => {
    const token = auth ? authStore.get()?.accessToken : undefined;
    return fetch(`${API_URL}/api${path}`, {
      ...rest,
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
  } catch {
    throw new ApiError(0, { statusCode: 0, code: 'INTERNAL', message: 'Server से connect नहीं हो पाया — internet check करें' });
  }
  if (res.status === 401 && auth && authStore.get()?.refreshToken && (await refresh())) res = await send();
  if (raw) return res as unknown as T;
  const text = await res.text();
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
  const contentType = (file as File).type || 'image/jpeg';
  const sig = await api<any>('/me/uploads/sign', { method: 'POST', body: { kind, contentType } });
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
        const r = safeJson(xhr.responseText);
        if (xhr.status >= 300 || !r?.secure_url) return reject(new Error(r?.error?.message ?? 'Upload failed'));
        resolve({ url: r.secure_url, publicId: r.public_id });
      };
      xhr.send(fd);
    } else {
      xhr.open('PUT', sig.uploadUrl);
      Object.entries(sig.headers ?? {}).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));
      xhr.onload = () => (xhr.status < 300 ? resolve({ url: sig.publicUrl }) : reject(new Error('Upload failed')));
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
