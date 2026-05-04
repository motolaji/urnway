import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { and, desc, eq, lte } from 'drizzle-orm';
import { getAddress, isAddress, verifyMessage } from 'viem';

import { db } from '../../db/client.js';
import { authNonces, refreshTokens } from '../../db/schema.js';
import { redis } from '../../lib/redis.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../lib/jwt.js';
import { findUserById, findUserByWalletAddress, createUser } from '../users/users.repository.js';
import { HttpError } from '../../utils/http-error.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type VerifyWalletInput = {
  walletAddress: string;
  message: string;
  signature: string;
};

const AUTH_NONCE_TTL_MS = 1000 * 60 * 20;

function getRevokedSessionKey(sessionId: string) {
  return `auth:session:revoked:${sessionId}`;
}

function normalizeWalletAddress(walletAddress: string) {
  if (!isAddress(walletAddress, { strict: false })) {
    throw new HttpError(400, 'Invalid wallet address');
  }

  return getAddress(walletAddress);
}

function buildNonceMessage(walletAddress: string, nonce: string) {
  return [
    'Sign this message to authenticate with Urnway.',
    '',
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function hashesEqual(left: string, right: string) {
  return timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

async function createSession(user: { id: string; walletAddress: string }) {
  const sessionId = randomUUID();
  const accessToken = signAccessToken({
    sub: user.id,
    walletAddress: user.walletAddress,
    sessionId,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    sessionId,
  });

  await db.insert(refreshTokens).values({
    id: sessionId,
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });

  return {
    accessToken,
    refreshToken,
    session: {
      id: sessionId,
      expiresInSeconds: {
        accessToken: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: REFRESH_TOKEN_TTL_SECONDS,
      },
    },
  };
}

async function revokeSession(sessionId: string) {
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.id, sessionId));

  await redis.set(
    getRevokedSessionKey(sessionId),
    '1',
    'EX',
    ACCESS_TOKEN_TTL_SECONDS
  );
}

export async function createNonce(walletAddress: string) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  const nonce = randomUUID();
  const message = buildNonceMessage(normalizedWalletAddress, nonce);
  const expiresAt = new Date(Date.now() + AUTH_NONCE_TTL_MS);

  // Keep other unexpired nonces alive so Android browser/custom-tab retries
  // do not invalidate a message that is already on screen in the wallet flow.
  await db
    .delete(authNonces)
    .where(
      and(
        eq(authNonces.walletAddress, normalizedWalletAddress),
        lte(authNonces.expiresAt, new Date())
      )
    );

  await db.insert(authNonces).values({
    walletAddress: normalizedWalletAddress,
    nonce,
    expiresAt,
  });

  return {
    message,
    walletAddress: normalizedWalletAddress,
    nonce,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyWalletSignature(input: VerifyWalletInput) {
  const normalizedWalletAddress = normalizeWalletAddress(input.walletAddress);
  const nonces = await db
    .select()
    .from(authNonces)
    .where(eq(authNonces.walletAddress, normalizedWalletAddress))
    .orderBy(desc(authNonces.createdAt));

  const matchingNonce = nonces.find((nonce) => {
    if (nonce.expiresAt.getTime() <= Date.now()) {
      return false;
    }

    return buildNonceMessage(normalizedWalletAddress, nonce.nonce) === input.message;
  });

  if (!matchingNonce) {
    throw new HttpError(401, 'Nonce is invalid or expired');
  }

  let verified = false;

  try {
    verified = await verifyMessage({
      address: normalizedWalletAddress,
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    throw new HttpError(401, 'Signature verification failed');
  }

  if (!verified) {
    throw new HttpError(401, 'Signature verification failed');
  }

  await db
    .delete(authNonces)
    .where(eq(authNonces.walletAddress, normalizedWalletAddress));

  let user = await findUserByWalletAddress(normalizedWalletAddress);

  if (!user) {
    user = await createUser(normalizedWalletAddress);
  }

  const session = await createSession(user);

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    session: session.session,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      mezoId: user.mezoId,
      email: user.email,
    },
  };
}

export async function refreshSession(refreshToken: string) {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }

  const [session] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.id, payload.sessionId),
        eq(refreshTokens.userId, payload.sub)
      )
    )
    .limit(1);

  if (!session || session.isRevoked || session.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'Refresh session is invalid or expired');
  }

  const hashedToken = hashToken(refreshToken);

  if (!hashesEqual(session.tokenHash, hashedToken)) {
    await revokeSession(session.id);
    throw new HttpError(401, 'Refresh token reuse detected');
  }

  const user = await findUserById(payload.sub);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  await revokeSession(session.id);
  const nextSession = await createSession(user);

  return {
    accessToken: nextSession.accessToken,
    refreshToken: nextSession.refreshToken,
    session: nextSession.session,
  };
}

export async function logoutSession({
  refreshToken,
  accessToken,
}: {
  refreshToken?: string;
  accessToken?: string;
}) {
  const revokedSessionIds = new Set<string>();

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await revokeSession(payload.sessionId);
      revokedSessionIds.add(payload.sessionId);
    } catch {
      throw new HttpError(401, 'Invalid or expired refresh token');
    }
  }

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      await redis.set(
        getRevokedSessionKey(payload.sessionId),
        '1',
        'EX',
        ACCESS_TOKEN_TTL_SECONDS
      );
      revokedSessionIds.add(payload.sessionId);
    } catch {
      if (!refreshToken) {
        throw new HttpError(401, 'Invalid or expired access token');
      }
    }
  }

  if (revokedSessionIds.size === 0) {
    throw new HttpError(
      400,
      'Provide a refresh token or bearer access token to logout'
    );
  }

  return {
    revoked: true,
    revokedSessionIds: [...revokedSessionIds],
  };
}

export async function getCurrentUser(user: AuthenticatedUser) {
  const storedUser = await findUserById(user.id);

  if (!storedUser) {
    throw new HttpError(404, 'User not found');
  }

  return {
    profile: {
      id: storedUser.id,
      walletAddress: storedUser.walletAddress,
      username: storedUser.username,
      mezoId: storedUser.mezoId,
      email: storedUser.email,
      sessionId: user.sessionId,
    },
  };
}
