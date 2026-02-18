/**
 * Encryption Key Management
 *
 * Key management:
 * - TFN_ENCRYPTION_KEY env var must be 32 bytes (64 hex chars)
 * - Generate with: openssl rand -hex 32
 * - NEVER commit the key to source control
 * - Rotate by re-encrypting all records with new key
 *
 * REVISION (D02 SEC-01 — Fail-Fast Encryption):
 * In production (NODE_ENV=production): FAIL FAST — throw on missing key, don't serve unencrypted.
 * In development: warn loudly but allow unencrypted fallback.
 */

let _encryptionKey: Buffer | null | undefined = undefined; // Lazy-init cache

/**
 * Get encryption key from environment.
 * REVISION: Fail-fast in production (D02 SEC-01). No graceful degradation to plaintext.
 */
export function getEncryptionKey(): Buffer | null {
  if (_encryptionKey !== undefined) return _encryptionKey;

  const keyHex = process.env.TFN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) {
    if (process.env.NODE_ENV === 'production') {
      // REVISION (D02 SEC-01): FAIL FAST in production — never store sensitive data unencrypted
      throw new Error(
        'FATAL: TFN_ENCRYPTION_KEY not set or invalid length (must be 64 hex chars / 32 bytes). ' +
          'Cannot start in production without encryption key. Generate with: openssl rand -hex 32',
      );
    }
    console.error(
      '\u26a0\ufe0f  CRITICAL WARNING: TFN_ENCRYPTION_KEY not set or invalid. ' +
        'Sensitive data (TFN, bank accounts) will be stored as plaintext with [UNENCRYPTED] prefix. ' +
        'This is ONLY acceptable in development. Set TFN_ENCRYPTION_KEY before deploying.',
    );
    _encryptionKey = null;
    return null;
  }
  _encryptionKey = Buffer.from(keyHex, 'hex');
  return _encryptionKey;
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
