import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  getBoardingPassHandler,
  getNextBoardingPassHandler,
  listBoardingPassesHandler,
} from './boarding-passes.controller.js';

export const boardingPassesRouter = Router();

boardingPassesRouter.get('/', requireAuth, listBoardingPassesHandler);
boardingPassesRouter.get('/next', requireAuth, getNextBoardingPassHandler);
boardingPassesRouter.get('/:id', requireAuth, getBoardingPassHandler);
