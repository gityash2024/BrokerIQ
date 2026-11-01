import { env } from '../config/env';

/** Never serialize an original public URL or the private storage key to a client. */
export function kycView<T extends { id: string; fileUrl: string }>(doc: T) {
  const { privateKey, fileSha256, ...safe } = doc as T & { privateKey?: string | null; fileSha256?: string | null };
  void privateKey;
  void fileSha256;
  return { ...safe, fileUrl: `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/media/kyc/${encodeURIComponent(doc.id)}` };
}
