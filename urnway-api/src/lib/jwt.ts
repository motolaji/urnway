import jwt, { type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env.js';

export type AccessTokenPayload = {
  sub: string;
  walletAddress: string;
  sessionId: string;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  type: 'refresh';
};

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof payload === 'string' ||
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    typeof payload.walletAddress !== 'string' ||
    typeof payload.sessionId !== 'string'
  ) {
    throw new Error('Invalid access token payload');
  }

  return {
    sub: payload.sub,
    walletAddress: payload.walletAddress,
    sessionId: payload.sessionId,
    type: payload.type,
  } satisfies AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

  if (
    typeof payload === 'string' ||
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.sessionId !== 'string'
  ) {
    throw new Error('Invalid refresh token payload');
  }

  return {
    sub: payload.sub,
    sessionId: payload.sessionId,
    type: payload.type,
  } satisfies RefreshTokenPayload;
}

export type JwtTokenPayload = JwtPayload;
