import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  getBalanceHandler,
  getBalanceActivityHandler,
  getBalanceWithdrawalHandler,
  getBalanceTopupHandler,
  prepareBalanceWithdrawalHandler,
  prepareBalanceTopupHandler,
  submitBalanceWithdrawalHandler,
  submitBalanceTopupHandler,
} from './balance.controller.js';

export const balanceRouter = Router();

balanceRouter.get('/', requireAuth, getBalanceHandler);
balanceRouter.get('/activity', requireAuth, getBalanceActivityHandler);
balanceRouter.post('/topups/prepare', requireAuth, prepareBalanceTopupHandler);
balanceRouter.get('/topups/:topupId', requireAuth, getBalanceTopupHandler);
balanceRouter.post('/topups/:topupId/submit', requireAuth, submitBalanceTopupHandler);
balanceRouter.post('/withdrawals/prepare', requireAuth, prepareBalanceWithdrawalHandler);
balanceRouter.get('/withdrawals/:withdrawalId', requireAuth, getBalanceWithdrawalHandler);
balanceRouter.post('/withdrawals/:withdrawalId/submit', requireAuth, submitBalanceWithdrawalHandler);
