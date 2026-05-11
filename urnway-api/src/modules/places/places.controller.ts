import type { RequestHandler } from 'express';

import { fail, ok } from '../../utils/api-response.js';
import { autocompletePlacesQuerySchema } from './places.schema.js';
import { autocompletePlaces } from './places.service.js';

export const autocompletePlacesHandler: RequestHandler = (req, res) => {
  try {
    const input = autocompletePlacesQuerySchema.parse(req.query);

    return Promise.resolve(autocompletePlaces(input)).then((data) => {
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
