import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  createNonceHandler,
  getCurrentUserHandler,
  logoutHandler,
  refreshSessionHandler,
  verifySignatureHandler,
} from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/nonce', createNonceHandler);
authRouter.post('/verify', verifySignatureHandler);
authRouter.post('/refresh', refreshSessionHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', requireAuth, getCurrentUserHandler);
