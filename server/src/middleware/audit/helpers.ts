/**
 * Audit Logging — Request parsing helpers
 *
 * Entity extraction, data redaction, IP resolution, metadata building.
 */

import { Context } from 'hono';

interface EntityInfo {
  entityType: string;
  entityId?: string;
}

const KNOWN_ACTIONS = [
  'reprocess',
  'split',
  'export',
  'import',
  'calculate',
  'resolve',
  'bulk-link',
  'auto-detect',
  'gap-analysis',
  'categorize-gst',
  'balance-history',
  'credit-analytics',
];

function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function isAction(segment: string): boolean {
  return KNOWN_ACTIONS.includes(segment);
}

/**
 * Extract entity type and ID from request path
 */
export function extractEntityInfo(path: string): EntityInfo {
  const cleanPath = path.split('?')[0].replace(/^\/+/, '');
  const segments = cleanPath.split('/');

  if (segments[0] === 'api' && segments.length >= 2) {
    const resource = segments[1];
    const entityType = singularize(resource);
    const entityId = segments[2] && !isAction(segments[2]) ? segments[2] : undefined;
    return { entityType, entityId };
  }

  if (segments[0] === 'auth') {
    return { entityType: 'auth', entityId: undefined };
  }

  return { entityType: segments[0] || 'unknown', entityId: undefined };
}

/**
 * Redact sensitive fields from an object
 */
export function redactSensitiveData(data: unknown, sensitiveFields: string[]): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, sensitiveFields));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = redactSensitiveData(value, sensitiveFields);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}

function isValidIpFormat(ip: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Pattern.test(ip)) {
    return ip.split('.').every((octet) => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Get client IP address from request headers.
 *
 * SECURITY NOTE: Validates IP format to prevent header injection.
 * In production, also configure trusted proxy count and validate
 * against known proxy IPs where possible.
 */
export function getClientIp(c: Context): string | null {
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0].trim();
    if (isValidIpFormat(clientIp)) return clientIp;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    const trimmedIp = realIp.trim();
    if (isValidIpFormat(trimmedIp)) return trimmedIp;
  }

  return null;
}

/**
 * Build audit metadata with safe URL parsing and query param redaction
 */
export function buildAuditMetadata(
  c: Context,
  requestId: string,
  sensitiveFields: string[],
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    requestId,
    contentType: c.req.header('content-type'),
  };

  try {
    const url = new URL(c.req.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      const isSensitive = sensitiveFields.some((field) =>
        key.toLowerCase().includes(field.toLowerCase()),
      );
      queryParams[key] = isSensitive ? '[REDACTED]' : value;
    }
    metadata.queryParams = queryParams;
  } catch {
    metadata.queryParams = { _error: 'Failed to parse URL' };
  }

  return metadata;
}
