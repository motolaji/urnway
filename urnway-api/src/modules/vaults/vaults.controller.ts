import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import { createVaultSchema, vaultIdSchema } from './vaults.schema.js';
import { createVault, getVaultById, listUserVaults } from './vaults.service.js';

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const listVaultsHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(listUserVaults(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const createVaultHandler: RequestHandler = (req, res) => {
  try {
    const input = createVaultSchema.parse(req.body);

    return Promise.resolve(createVault(getUserFromRequest(req), input)).then((data) => {
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

export const getVaultHandler: RequestHandler = (req, res) => {
  try {
    const { id } = vaultIdSchema.parse(req.params);

    return Promise.resolve(getVaultById(getUserFromRequest(req), id)).then((data) => {
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
