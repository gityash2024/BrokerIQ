import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { isApiErrorBody, type ApiErrorBody, type AuthResponse, type AuthUser } from '@brokeriq/shared';
import { create } from './store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3000/api').replace(/\/$/, '');
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

export const authStore = {
  async load() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      useSession.setState({ session: raw ? JSON.parse(raw) : null, ready: true });
    } catch {
      useSession.setState({ session: null, ready: true });
    }
  },
  get: () => useSession.getState().session,
  async set(s: Session | null) {
    useSession.setState({ session: s });
    if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
    else await SecureStore.deleteItemAsync(KEY);
  },
};

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const cur = authStore.get();
  if (!cur?.refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: cur.refreshToken }) });
      if (!res.ok) {
        await authStore.set(null);
        return false;
      }
      const d: AuthResponse = await res.json();
      await authStore.set({ accessToken: d.accessToken, refreshToken: d.refreshToken, user: d.user });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Opts = { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { body, auth = true, method = body === undefined ? 'GET' : 'POST', headers } = opts;
  const send = () => {
    const token = auth ? authStore.get()?.accessToken : undefined;
    return fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Client': 'app', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, { statusCode: 0, code: 'INTERNAL', message: 'Server से connect नहीं हो पाया — internet check करें' } as ApiErrorBody);
  }
  if (res.status === 401 && auth && authStore.get()?.refreshToken && (await refresh())) res = await send();
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(res.status, isApiErrorBody(data) ? data : ({ statusCode: res.status, code: 'INTERNAL', message: 'Request failed' } as ApiErrorBody));
  return data as T;
}

export const post = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: 'POST', body });
export const patch = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: 'PATCH', body });
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' });

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return e.body.message;
  if (e instanceof Error) return e.message;
  return 'कुछ गड़बड़ हुई';
}

export const qs = (o: Record<string, unknown>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

/** Direct upload (Cloudinary / S3) of a local file uri via a server signature. */
export async function uploadUri(uri: string, kind: string, mime = 'image/jpeg'): Promise<{ url: string; publicId?: string }> {
  const sig = await post<any>('/me/uploads/sign', { kind, contentType: mime });
  if (sig.provider === 'cloudinary') {
    const fd = new FormData();
    Object.entries(sig.fields as Record<string, string>).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', { uri, name: `upload.${mime.split('/')[1] ?? 'jpg'}`, type: mime } as any);
    const r = await fetch(sig.uploadUrl, { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok || !j.secure_url) throw new Error(j?.error?.message ?? 'Upload failed');
    return { url: j.secure_url, publicId: j.public_id };
  }
  const blob = await (await fetch(uri)).blob();
  const r = await fetch(sig.uploadUrl, { method: 'PUT', headers: sig.headers ?? { 'Content-Type': mime }, body: blob });
  if (!r.ok) throw new Error('Upload failed');
  return { url: sig.publicUrl };
}

/** On-the-fly resize for Cloudinary and self-hosted (/api/media) URLs; other URLs untouched. */
export function img(url?: string | null, w = 800) {
  if (!url) return undefined;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/c_')) return url.replace('/upload/', `/upload/c_limit,w_${w},q_auto,f_auto/`);
  if (url.includes('/api/media/f/') && !url.includes('?')) {
    const width = [320, 480, 800, 1200].find((x) => x >= w);
    return width ? `${url}?w=${width}` : url;
  }
  return url;
}
