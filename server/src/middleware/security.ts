/**
 * Security Headers Middleware
 *
 * Implements comprehensive security headers following OWASP recommendations.
 * Protects against XSS, clickjacking, MIME sniffing, and other common attacks.
 */

import { Context, MiddlewareHandler } from 'hono';

// ============================================================================
// SECURITY HEADER CONFIGURATION
// ============================================================================

export interface SecurityHeadersConfig {
  /** Enable Strict-Transport-Security */
  enableHSTS: boolean;
  /** HSTS max-age in seconds */
  hstsMaxAge: number;
  /** Include subdomains in HSTS */
  hstsIncludeSubdomains: boolean;
  /** Enable preload for HSTS */
  hstsPreload: boolean;
  /** X-Frame-Options value */
  frameOptions: 'DENY' | 'SAMEORIGIN' | false;
  /** X-Content-Type-Options */
  contentTypeOptions: boolean;
  /** X-XSS-Protection (legacy but still useful) */
  xssProtection: boolean;
  /** Referrer-Policy value */
  referrerPolicy: string;
  /** Permissions-Policy directives */
  permissionsPolicy: Record<string, string[]>;
  /** Content-Security-Policy directives */
  csp: CSPDirectives | false;
  /** Cross-Origin-Opener-Policy */
  crossOriginOpenerPolicy: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;
  /** Cross-Origin-Embedder-Policy */
  crossOriginEmbedderPolicy: 'require-corp' | 'credentialless' | 'unsafe-none' | false;
  /** Cross-Origin-Resource-Policy */
  crossOriginResourcePolicy: 'same-origin' | 'same-site' | 'cross-origin' | false;
}

export interface CSPDirectives {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  objectSrc?: string[];
  frameSrc?: string[];
  frameAncestors?: string[];
  formAction?: string[];
  baseUri?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_SECURITY_CONFIG: SecurityHeadersConfig = {
  enableHSTS: process.env.NODE_ENV === 'production',
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubdomains: true,
  hstsPreload: false,
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    geolocation: [],
    microphone: [],
    camera: [],
    payment: [],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: [],
  },
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Vite HMR in dev
    styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", 'https://openrouter.ai', 'https://api.openai.com', 'wss:', 'https:'],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production',
    blockAllMixedContent: process.env.NODE_ENV === 'production',
  },
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginEmbedderPolicy: false, // Can break some third-party embeds
  crossOriginResourcePolicy: 'same-origin',
};

// Development config with relaxed CSP for HMR
export const DEV_SECURITY_CONFIG: SecurityHeadersConfig = {
  ...DEFAULT_SECURITY_CONFIG,
  enableHSTS: false,
  csp: {
    ...(DEFAULT_SECURITY_CONFIG.csp as CSPDirectives),
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Vite HMR
    connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'], // Allow all for dev
  },
};

// ============================================================================
// HEADER BUILDERS
// ============================================================================

function buildHSTSHeader(config: SecurityHeadersConfig): string | null {
  if (!config.enableHSTS) return null;

  let value = `max-age=${config.hstsMaxAge}`;
  if (config.hstsIncludeSubdomains) {
    value += '; includeSubDomains';
  }
  if (config.hstsPreload) {
    value += '; preload';
  }
  return value;
}

function buildPermissionsPolicyHeader(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return `${directive}=()`;
      }
      return `${directive}=(${values.map((v) => (v === 'self' ? 'self' : `"${v}"`)).join(' ')})`;
    })
    .join(', ');
}

function buildCSPHeader(directives: CSPDirectives): string {
  const parts: string[] = [];

  if (directives.defaultSrc) {
    parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
  }
  if (directives.scriptSrc) {
    parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
  }
  if (directives.styleSrc) {
    parts.push(`style-src ${directives.styleSrc.join(' ')}`);
  }
  if (directives.imgSrc) {
    parts.push(`img-src ${directives.imgSrc.join(' ')}`);
  }
  if (directives.fontSrc) {
    parts.push(`font-src ${directives.fontSrc.join(' ')}`);
  }
  if (directives.connectSrc) {
    parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
  }
  if (directives.mediaSrc) {
    parts.push(`media-src ${directives.mediaSrc.join(' ')}`);
  }
  if (directives.objectSrc) {
    parts.push(`object-src ${directives.objectSrc.join(' ')}`);
  }
  if (directives.frameSrc) {
    parts.push(`frame-src ${directives.frameSrc.join(' ')}`);
  }
  if (directives.frameAncestors) {
    parts.push(`frame-ancestors ${directives.frameAncestors.join(' ')}`);
  }
  if (directives.formAction) {
    parts.push(`form-action ${directives.formAction.join(' ')}`);
  }
  if (directives.baseUri) {
    parts.push(`base-uri ${directives.baseUri.join(' ')}`);
  }
  if (directives.upgradeInsecureRequests) {
    parts.push('upgrade-insecure-requests');
  }
  if (directives.blockAllMixedContent) {
    parts.push('block-all-mixed-content');
  }
  if (directives.reportUri) {
    parts.push(`report-uri ${directives.reportUri}`);
  }
  if (directives.reportTo) {
    parts.push(`report-to ${directives.reportTo}`);
  }

  return parts.join('; ');
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Security headers middleware factory
 */
export function securityHeaders(customConfig?: Partial<SecurityHeadersConfig>): MiddlewareHandler {
  const config = {
    ...(process.env.NODE_ENV === 'production' ? DEFAULT_SECURITY_CONFIG : DEV_SECURITY_CONFIG),
    ...customConfig,
  };

  return async (c: Context, next: () => Promise<void>) => {
    await next();

    // Strict-Transport-Security
    const hstsHeader = buildHSTSHeader(config);
    if (hstsHeader) {
      c.header('Strict-Transport-Security', hstsHeader);
    }

    // X-Frame-Options
    if (config.frameOptions) {
      c.header('X-Frame-Options', config.frameOptions);
    }

    // X-Content-Type-Options
    if (config.contentTypeOptions) {
      c.header('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection (legacy but still useful for older browsers)
    if (config.xssProtection) {
      c.header('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      c.header('Referrer-Policy', config.referrerPolicy);
    }

    // Permissions-Policy
    if (config.permissionsPolicy && Object.keys(config.permissionsPolicy).length > 0) {
      c.header('Permissions-Policy', buildPermissionsPolicyHeader(config.permissionsPolicy));
    }

    // Content-Security-Policy
    if (config.csp) {
      c.header('Content-Security-Policy', buildCSPHeader(config.csp));
    }

    // Cross-Origin-Opener-Policy
    if (config.crossOriginOpenerPolicy) {
      c.header('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
    }

    // Cross-Origin-Embedder-Policy
    if (config.crossOriginEmbedderPolicy) {
      c.header('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (config.crossOriginResourcePolicy) {
      c.header('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
    }

    // Additional security headers
    c.header('X-DNS-Prefetch-Control', 'off');
    c.header('X-Download-Options', 'noopen');
    c.header('X-Permitted-Cross-Domain-Policies', 'none');
  };
}

// ============================================================================
// RATE LIMITING CONFIG BY ENDPOINT
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  '/auth/login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many login attempts. Please try again later.',
    skipSuccessfulRequests: true,
  },
  '/auth/register': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many registration attempts. Please try again later.',
  },
  '/auth/password-reset': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again later.',
  },
  '/api/chat': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many chat requests. Please slow down.',
  },
  '/api/statements/upload': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many uploads. Please wait before uploading more files.',
  },
  '/api/agents': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many agent requests. Please slow down.',
  },
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },
};

/**
 * Get rate limit config for a specific path
 */
export function getRateLimitConfig(path: string): RateLimitConfig {
  // Check for exact match first
  if (RATE_LIMIT_CONFIGS[path]) {
    return RATE_LIMIT_CONFIGS[path];
  }

  // Check for prefix match
  for (const [pattern, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (pattern !== 'default' && path.startsWith(pattern)) {
      return config;
    }
  }

  return RATE_LIMIT_CONFIGS.default;
}
