/**
 * Zod Validation Schemas — barrel re-export
 *
 * All schemas are defined in domain-specific files.
 * This file also provides the validateBody helper and ValidationError.
 */

export * from './common.js';
export * from './auth.js';
export * from './transactions.js';
export * from './accounts.js';
export * from './tax.js';
export * from './chat.js';
export * from './settings.js';

import { z } from 'zod';
import { ValidationError } from '../errors.js';
export { ValidationError } from '../errors.js';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    throw new ValidationError('Validation failed', errors);
  }

  return result.data;
}
