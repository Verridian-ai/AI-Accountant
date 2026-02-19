import { Hono } from 'hono';
import { registerGSTHandlers } from './gst-handlers.js';
import { registerCGTHandlers } from './cgt-handlers.js';
import { registerDepreciationHandlers } from './depreciation-handlers.js';

const taxExtRoutes = new Hono();

registerGSTHandlers(taxExtRoutes);
registerCGTHandlers(taxExtRoutes);
registerDepreciationHandlers(taxExtRoutes);

export default taxExtRoutes;
