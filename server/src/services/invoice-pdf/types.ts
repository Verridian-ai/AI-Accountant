/**
 * Invoice PDF — Constants, types, and utility functions.
 */

import { rgb } from 'pdf-lib';

// ============================================================================
// Constants
// ============================================================================

export const PAGE_WIDTH = 595.28; // A4 width in points
export const PAGE_HEIGHT = 841.89; // A4 height in points
export const MARGIN_LEFT = 50;
export const MARGIN_RIGHT = 50;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Colors
export const GOLD = rgb(1, 0.8, 0); // #FFCC00
export const DARK_TEXT = rgb(0.102, 0.106, 0.149); // #1a1b26
export const GREY_TEXT = rgb(0.4, 0.4, 0.4);
export const LIGHT_GREY = rgb(0.85, 0.85, 0.85);

// Font sizes
export const TITLE_SIZE = 22;
export const HEADING_SIZE = 11;
export const BODY_SIZE = 9.5;
export const SMALL_SIZE = 8;
