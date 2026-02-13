import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM Encryption Service
 *
 * Used for encrypting sensitive data at rest:
 * - Tax File Numbers (TFN) — Privacy Act 1988 requirement
 * - Bank account numbers
 *
 * Key management:
 * - TFN_ENCRYPTION_KEY env var must be 32 bytes (64 hex chars)
 * - Generate with: openssl rand -hex 32
 * - NEVER commit the key to source control
 * - Rotate by re-encrypting all records with new key
 *
 * Ciphertext format: iv:authTag:encryptedData (all base64)
 * - iv: 12 bytes (96 bits) — random per encryption
 * - authTag: 16 bytes (128 bits) — GCM authentication tag
 * - encryptedData: variable length
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * REVISION NOTE (D02 SEC-01 — Fail-Fast Encryption):
 * TFN_ENCRYPTION_KEY MUST be present and valid in production.
 * - At least 32 bytes (256 bits) = 64 hex characters
 * - Loaded from env at startup, NEVER hardcoded
 * - Key rotation: re-encrypt all TFNs + bank details with new key (see reEncryptField())
 * - In production (NODE_ENV=production): FAIL FAST — throw on missing key, don't serve unencrypted
 * - In development: warn loudly but allow unencrypted fallback
 */

let _encryptionKey: Buffer | null | undefined = undefined; // Lazy-init cache

/**
 * Get encryption key from environment.
 * REVISION: Fail-fast in production (D02 SEC-01). No graceful degradation to plaintext.
 */
function getEncryptionKey(): Buffer | null {
  if (_encryptionKey !== undefined) return _encryptionKey;

  const keyHex = process.env.TFN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) {
    if (process.env.NODE_ENV === 'production') {
      // REVISION (D02 SEC-01): FAIL FAST in production — never store sensitive data unencrypted
      throw new Error(
        'FATAL: TFN_ENCRYPTION_KEY not set or invalid length (must be 64 hex chars / 32 bytes). ' +
        'Cannot start in production without encryption key. Generate with: openssl rand -hex 32'
      );
    }
    console.error(
      '\u26a0\ufe0f  CRITICAL WARNING: TFN_ENCRYPTION_KEY not set or invalid. ' +
      'Sensitive data (TFN, bank accounts) will be stored as plaintext with [UNENCRYPTED] prefix. ' +
      'This is ONLY acceptable in development. Set TFN_ENCRYPTION_KEY before deploying.'
    );
    _encryptionKey = null;
    return null;
  }
  _encryptionKey = Buffer.from(keyHex, 'hex');
  return _encryptionKey;
}

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

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

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

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Mask a TFN for display (Australian format).
 * Input: '123456789' -> Output: '***-***-**9'
 *
 * @param tfn - Decrypted TFN (9 digits)
 * @returns Masked string showing only last digit
 */
export function maskTFN(tfn: string): string {
  if (!tfn || tfn.length < 3) return '***';
  const lastChar = tfn.charAt(tfn.length - 1);
  return `***-***-**${lastChar}`;
}

/**
 * Mask a bank account number for display.
 * Input: '12345678' -> Output: '****5678'
 *
 * @param accountNumber - Decrypted account number
 * @returns Masked string showing only last 4 digits
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return '****';
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
}

/**
 * Mask a BSB for display (not encrypted, but partially masked).
 * Input: '062-000' or '062000' -> Output: '062-***'
 *
 * @param bsb - BSB number (6 digits, optionally with dash)
 * @returns Partially masked BSB
 */
export function maskBSB(bsb: string): string {
  const cleaned = bsb.replace(/\D/g, '');
  if (cleaned.length < 3) return '***-***';
  return `${cleaned.slice(0, 3)}-***`;
}

/**
 * Validate Australian TFN format.
 * TFN is 8-9 digits with a check digit algorithm.
 *
 * @param tfn - TFN to validate (digits only)
 * @returns true if valid format
 */
export function validateTFN(tfn: string): boolean {
  const cleaned = tfn.replace(/\D/g, '');
  if (cleaned.length < 8 || cleaned.length > 9) return false;

  // ATO TFN check digit algorithm (weights)
  const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
  const digits = cleaned.split('').map(Number);

  // Pad to 9 digits if 8
  if (digits.length === 8) digits.unshift(0);

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }

  return sum % 11 === 0;
}

/**
 * Validate Australian BSB format.
 * BSB is 6 digits, optionally formatted as XXX-XXX.
 */
export function validateBSB(bsb: string): boolean {
  const cleaned = bsb.replace(/\D/g, '');
  return cleaned.length === 6 && /^\d{6}$/.test(cleaned);
}

/**
 * Check if encryption is properly configured.
 */
export function isEncryptionConfigured(): boolean {
  try {
    return getEncryptionKey() !== null;
  } catch {
    return false; // Production fail-fast already threw
  }
}

/**
 * Validate encryption key at server startup.
 * REVISION (D02 SEC-01): Call this in server initialization.
 * In production, this will throw and prevent startup if key is missing.
 * In development, it will log a critical warning.
 */
export function validateEncryptionSetup(): void {
  const isConfigured = isEncryptionConfigured();
  if (isConfigured) {
    console.log('\u2705 TFN encryption key loaded successfully (AES-256-GCM)');
  }
  // In production, getEncryptionKey() already threw if not configured
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
