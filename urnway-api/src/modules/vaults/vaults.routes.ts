import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  createVaultHandler,
  getVaultHandler,
  listVaultsHandler,
} from './vaults.controller.js';

export const vaultsRouter = Router();

vaultsRouter.get('/', requireAuth, listVaultsHandler);
vaultsRouter.post('/', requireAuth, createVaultHandler);
vaultsRouter.get('/:id', requireAuth, getVaultHandler);
