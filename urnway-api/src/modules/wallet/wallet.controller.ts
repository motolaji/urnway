import type { RequestHandler } from 'express';

import { ok } from '../../utils/api-response.js';
import {
  getWalletBalance,
  getWalletPosition,
  getWalletTransactions,
} from './wallet.service.js';

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const getBalanceHandler: RequestHandler = (req, res) => {
  Promise.resolve(getWalletBalance(getUserFromRequest(req)))
    .then((data) => {
      res.json(ok(data));
    })
    .catch((error) => {
      res.status(500).json({
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Wallet balance failed',
          details: null,
        },
        meta: null,
      });
    });
};

export const getPositionHandler: RequestHandler = (req, res) => {
  Promise.resolve(getWalletPosition())
    .then((data) => {
      res.json(ok(data));
    })
    .catch((error) => {
      res.status(500).json({
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Wallet position failed',
          details: null,
        },
        meta: null,
      });
    });
};

export const getTransactionsHandler: RequestHandler = (req, res) => {
  Promise.resolve(getWalletTransactions(getUserFromRequest(req)))
    .then((data) => {
      res.json(ok(data));
    })
    .catch((error) => {
      res.status(500).json({
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : 'Wallet transactions failed',
          details: null,
        },
        meta: null,
      });
    });
};
