/**
 * Feedback Module — Barrel Export
 */

export * from './types.js';
export { FeedbackManager } from './feedback-manager.js';

// Import analysis module to register prototype extensions
import './feedback-analysis.js';

import { FeedbackManager } from './feedback-manager.js';

// Export singleton instance
export const feedbackManager = new FeedbackManager();
