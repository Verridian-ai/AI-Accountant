/**
 * AES-256-GCM Symmetric Encryption
 *
 * Ciphertext format: iv:authTag:encryptedData (all base64)
 * - iv: 12 bytes (96 bits) — random per encryption
 * - authTag: 16 bytes (128 bits) — GCM authentication tag
 * - encryptedData: variable length
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ALGORITHM, IV_LENGTH, TAG_LENGTH } from './constants.js';
import { getEncryptionKey } from './key-management.js';

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns Encrypted string in format "iv:tag:data" (all base64)
 *
 * @example
 * const encrypted = encryptField('123456789'); // TFN
 * // Returns: "base64iv:base64tag:base64data"
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // Graceful degradation in dev — prefix to indicate unencrypted
    return `[UNENCRYPTED]${plaintext}`;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 *
 * @param ciphertext - Encrypted string in "iv:tag:data" format
 * @returns Original plaintext
 * @throws Error if decryption fails (wrong key, tampered data)
 *
 * @example
 * const tfn = decryptField(encrypted);
 * // Returns: '123456789'
 */
export function decryptField(ciphertext: string): string {
  // Handle unencrypted fallback
  if (ciphertext.startsWith('[UNENCRYPTED]')) {
    return ciphertext.slice('[UNENCRYPTED]'.length);
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('Cannot decrypt: TFN_ENCRYPTION_KEY not configured');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:tag:data');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const data = Buffer.from(parts[2], 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length} (expected ${IV_LENGTH})`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Key rotation utility: re-encrypt a field with a new key.
 *
 * Usage for key rotation:
 * 1. Set OLD_TFN_ENCRYPTION_KEY=<old_key> and TFN_ENCRYPTION_KEY=<new_key>
 * 2. For each encrypted record: reEncryptField(ciphertext, oldKeyHex)
 * 3. Update record in database
 * 4. Remove OLD_TFN_ENCRYPTION_KEY after all records migrated
 *
 * @param ciphertext - Data encrypted with old key
 * @param oldKeyHex - Previous encryption key (hex)
 * @returns Re-encrypted data with current key
 */
export function reEncryptField(ciphertext: string, oldKeyHex: string): string {
  if (ciphertext.startsWith('[UNENCRYPTED]')) {
    // Was unencrypted — just encrypt with current key
    return encryptField(ciphertext.slice('[UNENCRYPTED]'.length));
  }

  const oldKey = Buffer.from(oldKeyHex, 'hex');
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');

  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const data = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGORITHM, oldKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');

  return encryptField(plaintext); // Re-encrypt with current key
}
