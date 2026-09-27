import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../../config/env';

/** AES-256-GCM field encryption for credentials at rest. Format: v1:<iv>:<tag>:<ciphertext> (base64). */
@Injectable()
export class CryptoService {
  private readonly key = Buffer.from(env().ENCRYPTION_MASTER_KEY, 'hex');

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [v, iv, tag, data] = payload.split(':');
    if (v !== 'v1' || !iv || !tag || !data) throw new Error('Invalid encrypted payload');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }
}
