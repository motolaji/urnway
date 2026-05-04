import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  getBalanceHandler,
  getPositionHandler,
  getTransactionsHandler,
} from './wallet.controller.js';

export const walletRouter = Router();

walletRouter.get('/balance', requireAuth, getBalanceHandler);
walletRouter.get('/position', requireAuth, getPositionHandler);
walletRouter.get('/transactions', requireAuth, getTransactionsHandler);
