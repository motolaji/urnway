import { randomUUID } from 'node:crypto';

import {
  findUserByPublicUserId,
  updateUserById,
} from './users.repository.js';

function buildPublicUserIdCandidate() {
  return `pub_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

export async function generateUniquePublicUserId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = buildPublicUserIdCandidate();
    const existingUser = await findUserByPublicUserId(candidate);

    if (!existingUser) {
      return candidate;
    }
  }

  throw new Error('Could not generate a unique publicUserId');
}

export async function ensureUserPublicUserId<T extends { id: string; publicUserId: string | null }>(
  user: T
) {
  if (user.publicUserId) {
    return user.publicUserId;
  }

  const publicUserId = await generateUniquePublicUserId();
  await updateUserById(user.id, {
    publicUserId,
  });

  return publicUserId;
}
