/**
 * Supplier Management Service — Bank Account Encryption Helpers
 *
 * AES-256-GCM (authenticated encryption) for bank account numbers.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../../lib/config.js';

// ---------------------------------------------------------------------------
// Encryption config
// ---------------------------------------------------------------------------

const BANK_ENCRYPTION_KEY = config.encryptionKey;
if (!BANK_ENCRYPTION_KEY && config.isProduction) {
  throw new Error('BANK_ENCRYPTION_KEY must be set in production');
}
const ENCRYPTION_KEY_STR = BANK_ENCRYPTION_KEY || 'default-32-char-encryption-key!!'; // 32 bytes
const IV_LENGTH = 12; // GCM standard 12-byte IV

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY_STR), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encrypted (all hex)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY_STR), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '';
  return '****' + accountNumber.slice(-4);
}
