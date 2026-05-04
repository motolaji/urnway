import { and, desc, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { tripVaults } from '../../db/schema.js';

type CreateTripVaultRecordInput = {
  userId: string;
  name: string;
  targetAmount: string;
  allocatedAmount?: string;
  currency?: string;
  note?: string | null;
  status?: string;
};

export async function createTripVaultRecord(input: CreateTripVaultRecordInput) {
  const [tripVault] = await db
    .insert(tripVaults)
    .values({
      userId: input.userId,
      name: input.name,
      targetAmount: input.targetAmount,
      allocatedAmount: input.allocatedAmount ?? '0',
      currency: input.currency ?? 'MUSD',
      note: input.note ?? null,
      status: input.status ?? 'active',
    })
    .returning();

  return tripVault;
}

export async function listTripVaultsForUser(userId: string) {
  return db
    .select()
    .from(tripVaults)
    .where(eq(tripVaults.userId, userId))
    .orderBy(desc(tripVaults.createdAt));
}

export async function findTripVaultById(id: string) {
  const [tripVault] = await db
    .select()
    .from(tripVaults)
    .where(eq(tripVaults.id, id))
    .limit(1);

  return tripVault ?? null;
}

export async function findTripVaultByIdForUser(userId: string, id: string) {
  const [tripVault] = await db
    .select()
    .from(tripVaults)
    .where(and(eq(tripVaults.userId, userId), eq(tripVaults.id, id)))
    .limit(1);

  return tripVault ?? null;
}
