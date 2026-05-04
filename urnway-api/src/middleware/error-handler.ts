import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { fail } from '../utils/api-response.js';
import { HttpError } from '../utils/http-error.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json(fail('Validation failed', err.flatten()));
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json(fail(err.message, err.details));
    return;
  }

  if (err instanceof Error) {
    res.status(500).json(fail(err.message));
    return;
  }

  res.status(500).json(fail('Internal server error'));
};
