// tests/common/crypto_utils.js
const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY = crypto.createHash('sha256').update('brokeriq_super_secret_master_key_2026').digest();

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} text - Plaintext to encrypt
 * @param {Buffer} [key] - 32-byte master key
 * @returns {string} iv:authTag:ciphertext (hex)
 */
function encrypt(text, key = DEFAULT_KEY) {
  if (typeof text !== 'string') {
    throw new TypeError('Input text must be a string');
  }
  const iv = crypto.randomBytes(12); // 96-bit IV standard for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM ciphertext
 * @param {string} cipherText - iv:authTag:ciphertext (hex)
 * @param {Buffer} [key] - 32-byte master key
 * @returns {string} Plaintext
 */
function decrypt(cipherText, key = DEFAULT_KEY) {
  if (typeof cipherText !== 'string' || !cipherText.includes(':')) {
    throw new Error('Invalid ciphertext format. Expected iv:authTag:ciphertext');
  }
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed ciphertext payload');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  if (iv.length !== 12) {
    throw new Error('Invalid IV length for AES-256-GCM');
  }
  if (authTag.length !== 16) {
    throw new Error('Invalid Auth Tag length for AES-256-GCM');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Mask secret string: show last 4 chars preceded by bullets
 * @param {string} secret
 * @returns {string}
 */
function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '••••••••••••';
  if (secret.length <= 4) return '••••••••••••';
  return '••••••••••••' + secret.slice(-4);
}

module.exports = {
  encrypt,
  decrypt,
  maskSecret,
  DEFAULT_KEY
};
