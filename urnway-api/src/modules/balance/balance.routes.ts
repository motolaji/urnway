import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  getBalanceHandler,
  getBalanceTopupHandler,
  prepareBalanceTopupHandler,
  submitBalanceTopupHandler,
} from './balance.controller.js';

export const balanceRouter = Router();

balanceRouter.get('/', requireAuth, getBalanceHandler);
balanceRouter.post('/topups/prepare', requireAuth, prepareBalanceTopupHandler);
balanceRouter.get('/topups/:topupId', requireAuth, getBalanceTopupHandler);
balanceRouter.post('/topups/:topupId/submit', requireAuth, submitBalanceTopupHandler);
