import type { RequestHandler } from 'express';

import { fail } from '../utils/api-response.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(fail('Route not found'));
};
