/** Return an API-relative path only for this deployment. Never send a bearer token to an upload/provider URL. */
export function privateMediaPath(value: string, apiUrl: string): string | null {
  if (!value || /[\\\u0000-\u0020]/.test(value) || /%(?:2f|5c|2e|00)/i.test(value)) return null;
  try {
    const base = new URL(apiUrl);
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(value);
    if (!absolute && (!value.startsWith('/') || value.startsWith('//') || value.split('/').includes('..'))) return null;
    const url = new URL(value, base.origin);
    if (url.origin !== base.origin || url.username || url.password || url.hash) return null;
    const path = url.pathname.startsWith('/api/') ? url.pathname.slice(4) : !absolute ? url.pathname : '';
    if (!/^\/(?:media|imports|inventory)\//.test(path)) return null;
    return path + url.search;
  } catch {
    return null;
  }
}
