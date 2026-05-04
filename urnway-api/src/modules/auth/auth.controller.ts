import type { RequestHandler } from 'express';

import { createNonceSchema, logoutSchema, refreshSessionSchema, verifySignatureSchema } from './auth.schema.js';
import {
  createNonce,
  getCurrentUser,
  logoutSession,
  refreshSession,
  verifyWalletSignature,
} from './auth.service.js';
import { ok } from '../../utils/api-response.js';

function getBearerToken(authorization?: string) {
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorization.slice(7);
}

export const createNonceHandler: RequestHandler = async (req, res) => {
  const input = createNonceSchema.parse(req.body);

  res.json(ok(await createNonce(input.walletAddress)));
};

export const verifySignatureHandler: RequestHandler = async (req, res) => {
  const input = verifySignatureSchema.parse(req.body);

  res.json(ok(await verifyWalletSignature(input)));
};

export const refreshSessionHandler: RequestHandler = async (req, res) => {
  const input = refreshSessionSchema.parse(req.body);

  res.json(ok(await refreshSession(input.refreshToken)));
};

export const logoutHandler: RequestHandler = async (req, res) => {
  const input = logoutSchema.parse(req.body);

  res.json(
    ok(
      await logoutSession({
        refreshToken: input.refreshToken,
        accessToken: getBearerToken(req.headers.authorization),
      })
    )
  );
};

export const getCurrentUserHandler: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({
      data: null,
      error: {
        message: 'Unauthorized',
        details: null,
      },
      meta: null,
    });
    return;
  }

  res.json(ok(await getCurrentUser(req.user)));
};
