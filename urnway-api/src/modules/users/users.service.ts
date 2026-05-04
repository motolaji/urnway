import { HttpError } from '../../utils/http-error.js';
import {
  findUserById,
  findUserByUsername,
  updateUserById,
} from './users.repository.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type UpdateCurrentUserInput = {
  username?: string;
  mezoId?: string;
  email?: string;
};

type UpdatePushTokenInput = {
  pushToken: string;
  platform?: 'ios' | 'android' | 'web';
};

export async function getCurrentUserProfile(user: AuthenticatedUser) {
  const storedUser = await findUserById(user.id);

  if (!storedUser) {
    throw new HttpError(404, 'User not found');
  }

  return {
    profile: {
      id: storedUser.id,
      walletAddress: storedUser.walletAddress,
      username: storedUser.username,
      displayName: storedUser.username ?? storedUser.mezoId ?? storedUser.walletAddress,
      mezoId: storedUser.mezoId,
      email: storedUser.email,
      pushTokenRegistered: false,
      sessionId: user.sessionId,
    },
  };
}

export async function updateCurrentUserProfile(
  user: AuthenticatedUser,
  input: UpdateCurrentUserInput
) {
  const storedUser = await findUserById(user.id);

  if (!storedUser) {
    throw new HttpError(404, 'User not found');
  }

  if (input.username) {
    const existingUser = await findUserByUsername(input.username);

    if (existingUser && existingUser.id !== user.id) {
      throw new HttpError(409, 'Username is already taken');
    }
  }

  const updatedUser = await updateUserById(user.id, {
    username: input.username ?? storedUser.username,
    mezoId: input.mezoId ?? storedUser.mezoId,
    email: input.email ?? storedUser.email,
  });

  if (!updatedUser) {
    throw new HttpError(404, 'User not found');
  }

  return {
    profile: {
      id: updatedUser.id,
      walletAddress: updatedUser.walletAddress,
      username: updatedUser.username,
      displayName:
        updatedUser.username ?? updatedUser.mezoId ?? updatedUser.walletAddress,
      mezoId: updatedUser.mezoId,
      email: updatedUser.email,
      pushTokenRegistered: false,
      sessionId: user.sessionId,
    },
  };
}

export function getCurrentUserPushToken(user: AuthenticatedUser) {
  return {
    message: 'todo push token read',
    userId: user.id,
    pushToken: null,
  };
}

export function updateCurrentUserPushToken(
  user: AuthenticatedUser,
  input: UpdatePushTokenInput
) {
  return {
    message: 'todo push token update',
    userId: user.id,
    pushToken: input.pushToken,
    platform: input.platform ?? null,
    note: 'Persist the Expo push token on the user record or a dedicated device table.',
  };
}

export async function getPublicUserProfile(username: string) {
  const user = await findUserByUsername(username);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return {
    profile: {
      username: user.username,
      displayName: user.username ?? user.mezoId ?? user.walletAddress,
      avatarUrl: null,
    },
  };
}

export function searchUsers(query: string) {
  return {
    message: 'todo user search',
    query,
    results: [],
  };
}

export function getUserContacts(user: AuthenticatedUser) {
  return {
    message: 'todo user contacts',
    userId: user.id,
    contacts: [],
  };
}
