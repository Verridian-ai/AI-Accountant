import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerMainChatHandler } from './main-handler.js';
import { registerStreamHandler } from './stream-handler.js';
import { registerConfirmationHandlers } from './confirmation-handlers.js';

const chatRoutes = new Hono();

chatRoutes.use('/*', tenantAuthMiddleware());

registerMainChatHandler(chatRoutes);
registerStreamHandler(chatRoutes);
registerConfirmationHandlers(chatRoutes);

export default chatRoutes;
