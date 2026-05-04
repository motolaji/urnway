import { eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function findUserByWalletAddress(walletAddress: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress))
    .limit(1);

  return user ?? null;
}

export async function findUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user ?? null;
}

export async function createUser(walletAddress: string) {
  const [user] = await db.insert(users).values({ walletAddress }).returning();
  return user;
}

export async function updateUserById(
  id: string,
  updates: Partial<{
    username: string | null;
    mezoId: string | null;
    email: string | null;
  }>
) {
  const [user] = await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return user ?? null;
}
