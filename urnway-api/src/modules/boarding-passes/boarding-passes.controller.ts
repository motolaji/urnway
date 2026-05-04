import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import { boardingPassIdSchema } from '../bookings/bookings.schema.js';
import {
  getBoardingPassById,
  getNextBoardingPass,
  listUserBoardingPasses,
} from './boarding-passes.service.js';

function getUserFromRequest(req: Express.Request) {
  if (!req.user) {
    throw new Error('Authenticated user missing from request');
  }

  return req.user;
}

export const listBoardingPassesHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(listUserBoardingPasses(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const getNextBoardingPassHandler: RequestHandler = (req, res) => {
  try {
    return Promise.resolve(getNextBoardingPass(getUserFromRequest(req))).then((data) => {
      res.json(ok(data));
    });
  } catch (error) {
    res.status(401).json(fail(error instanceof Error ? error.message : 'Unauthorized'));
  }
};

export const getBoardingPassHandler: RequestHandler = (req, res) => {
  try {
    const { id } = boardingPassIdSchema.parse(req.params);

    return Promise.resolve(getBoardingPassById(getUserFromRequest(req), id)).then((data) => {
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
