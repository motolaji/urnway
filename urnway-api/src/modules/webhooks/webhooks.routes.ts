import { Router } from 'express';

import { handleGoldskyWebhook, handleMezoWebhook } from './webhooks.controller.js';

export const webhooksRouter = Router();

webhooksRouter.post('/mezo', handleMezoWebhook);
webhooksRouter.post('/goldsky', handleGoldskyWebhook);
