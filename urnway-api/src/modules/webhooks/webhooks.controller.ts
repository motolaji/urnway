import type { RequestHandler } from 'express';

import { ok } from '../../utils/api-response.js';
import { handleGoldskyTransferWebhook } from './webhooks.service.js';

export const handleMezoWebhook: RequestHandler = (_req, res) => {
  res.status(202).json(
    ok({
      message: 'todo webhook handler',
      provider: 'mezo',
    })
  );
};

export const handleGoldskyWebhook: RequestHandler = (req, res) =>
  Promise.resolve(handleGoldskyTransferWebhook(req.body)).then((data) => {
    res.status(202).json(ok(data));
  });
