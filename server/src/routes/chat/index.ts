import { Hono } from 'hono';
import { registerMainChatHandler } from './main-handler.js';
import { registerStreamHandler } from './stream-handler.js';
import { registerConfirmationHandlers } from './confirmation-handlers.js';

const chatRoutes = new Hono();

registerMainChatHandler(chatRoutes);
registerStreamHandler(chatRoutes);
registerConfirmationHandlers(chatRoutes);

export default chatRoutes;
