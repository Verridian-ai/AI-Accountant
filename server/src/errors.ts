/**
 * Custom Error Classes for AI Accountant
 *
 * Structured error hierarchy for better error handling and logging
 */

// ============================================================================
// BASE ERROR
// ============================================================================

export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

// ============================================================================
// PDF & PARSING ERRORS
// ============================================================================

export class PdfParsingError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PDF_PARSING_ERROR', 422, true, context);
  }
}

export class AiParseError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AI_PARSE_ERROR', 422, true, context);
  }
}

export class StatementDetectionError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STATEMENT_DETECTION_ERROR', 422, true, context);
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class ValidationError extends BaseError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    errors: Array<{ field: string; message: string }> = [],
    context?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

// ============================================================================
// AUTHENTICATION ERRORS
// ============================================================================

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, context);
  }
}

// ============================================================================
// RESOURCE ERRORS
// ============================================================================

export class NotFoundError extends BaseError {
  constructor(resource: string, id?: string, context?: Record<string, unknown>) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, context);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, true, context);
  }
}

export class DuplicateError extends BaseError {
  constructor(resource: string, field: string, value?: string, context?: Record<string, unknown>) {
    const message = value
      ? `${resource} with ${field} '${value}' already exists`
      : `${resource} with duplicate ${field} already exists`;
    super(message, 'DUPLICATE_ERROR', 409, true, context);
  }
}

// ============================================================================
// EXTERNAL SERVICE ERRORS
// ============================================================================

export class ExternalServiceError extends BaseError {
  public readonly service: string;

  constructor(service: string, message: string, context?: Record<string, unknown>) {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, true, context);
    this.service = service;
  }
}

export class AiServiceError extends BaseError {
  public readonly service: string = 'AI Service';

  constructor(message: string, context?: Record<string, unknown>) {
    super(`AI Service: ${message}`, 'AI_SERVICE_ERROR', 502, true, context);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, false, context);
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export class RateLimitError extends BaseError {
  public readonly retryAfter: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60,
    context?: Record<string, unknown>,
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, context);
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// BUSINESS LOGIC ERRORS
// ============================================================================

export class InsufficientDataError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INSUFFICIENT_DATA', 400, true, context);
  }
}

export class ProcessingError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PROCESSING_ERROR', 422, true, context);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

export function toHttpError(error: Error): { status: number; body: object } {
  if (error instanceof BaseError) {
    return {
      status: error.statusCode,
      body: error.toJSON(),
    };
  }

  // Unknown errors become 500
  return {
    status: 500,
    body: {
      name: 'InternalError',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    },
  };
}
