import type { RequestHandler } from 'express';

import { redis } from '../lib/redis.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { fail } from '../utils/api-response.js';

const getRevokedSessionKey = (sessionId: string) =>
  `auth:session:revoked:${sessionId}`;

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(fail('Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    const isRevoked = await redis.exists(getRevokedSessionKey(payload.sessionId));

    if (isRevoked) {
      res.status(401).json(fail('Session has been revoked'));
      return;
    }

    req.user = {
      id: payload.sub,
      walletAddress: payload.walletAddress,
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid access token payload') {
      res.status(401).json(fail('Invalid or expired token'));
      return;
    }

    next(error);
    return;
  }
};
