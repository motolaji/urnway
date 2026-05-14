import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import {
  prepareBalanceWithdrawalSchema,
  prepareBalanceTopupSchema,
  submitBalanceWithdrawalSchema,
  submitBalanceTopupSchema,
  topupIdSchema,
  withdrawalIdSchema,
} from './balance.schema.js';
import {
  getBalance,
  getBalanceActivity,
  getBalanceWithdrawal,
  getBalanceTopup,
  prepareBalanceWithdrawal,
  prepareBalanceTopup,
  submitBalanceWithdrawal,
  submitBalanceTopup,
} from './balance.service.js';

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const getBalanceHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(getBalance(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const getBalanceActivityHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(getBalanceActivity(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const prepareBalanceTopupHandler: RequestHandler = (req, res) => {
  try {
    const input = prepareBalanceTopupSchema.parse(req.body);

    return Promise.resolve(
      prepareBalanceTopup(getUserFromRequest(req), input)
    ).then((data) => {
      res.status(201).json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const getBalanceTopupHandler: RequestHandler = (req, res) => {
  try {
    const { topupId } = topupIdSchema.parse(req.params);

    return Promise.resolve(
      getBalanceTopup(getUserFromRequest(req), topupId)
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const submitBalanceTopupHandler: RequestHandler = (req, res) => {
  try {
    const { topupId } = topupIdSchema.parse(req.params);
    const input = submitBalanceTopupSchema.parse(req.body);

    return Promise.resolve(
      submitBalanceTopup(getUserFromRequest(req), topupId, input)
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const prepareBalanceWithdrawalHandler: RequestHandler = (req, res) => {
  try {
    const input = prepareBalanceWithdrawalSchema.parse(req.body);

    return Promise.resolve(
      prepareBalanceWithdrawal(getUserFromRequest(req), input)
    ).then((data) => {
      res.status(201).json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const getBalanceWithdrawalHandler: RequestHandler = (req, res) => {
  try {
    const { withdrawalId } = withdrawalIdSchema.parse(req.params);

    return Promise.resolve(
      getBalanceWithdrawal(getUserFromRequest(req), withdrawalId)
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};

export const submitBalanceWithdrawalHandler: RequestHandler = (req, res) => {
  try {
    const { withdrawalId } = withdrawalIdSchema.parse(req.params);
    submitBalanceWithdrawalSchema.parse(req.body ?? {});

    return Promise.resolve(
      submitBalanceWithdrawal(getUserFromRequest(req), withdrawalId)
    ).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authenticated user missing from request') {
      res.status(401).json(fail(error.message));
      return;
    }

    throw error;
  }
};
