import type { RequestHandler } from 'express';

import { ok } from '../../utils/api-response.js';

export const getHealth: RequestHandler = (_req, res) => {
  res.json(
    ok({
      service: 'urnway-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  );
};
