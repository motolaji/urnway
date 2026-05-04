import { HttpError } from '../../utils/http-error.js';
import {
  createTripVaultRecord,
  findTripVaultByIdForUser,
  listTripVaultsForUser,
} from './vaults.repository.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type CreateVaultInput = {
  name: string;
  targetAmount: string;
  note?: string;
};

function toSafeNumber(value: string) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function calculateProgressPercent(targetAmount: string, allocatedAmount: string) {
  const target = toSafeNumber(targetAmount);
  const allocated = toSafeNumber(allocatedAmount);

  if (target <= 0) {
    return 0;
  }

  const progress = (allocated / target) * 100;
  return Math.max(0, Math.min(100, Number(progress.toFixed(1))));
}

function formatAmount(value: number) {
  return value.toFixed(2).replace(/\.00$/, '');
}

function serializeVault(vault: Awaited<ReturnType<typeof findTripVaultByIdForUser>>) {
  if (!vault) {
    return null;
  }

  const target = toSafeNumber(vault.targetAmount);
  const allocated = toSafeNumber(vault.allocatedAmount);
  const remaining = Math.max(0, target - allocated);

  return {
    id: vault.id,
    name: vault.name,
    targetAmount: vault.targetAmount,
    allocatedAmount: vault.allocatedAmount,
    remainingAmount: formatAmount(remaining),
    progressPercent: calculateProgressPercent(vault.targetAmount, vault.allocatedAmount),
    currency: vault.currency,
    note: vault.note,
    status: vault.status,
    createdAt: vault.createdAt.toISOString(),
    updatedAt: vault.updatedAt.toISOString(),
  };
}

export async function listUserVaults(user: AuthenticatedUser) {
  const vaults = await listTripVaultsForUser(user.id);
  const serializedVaults = vaults.map((vault) => serializeVault(vault)).filter(Boolean);

  const totalTarget = vaults.reduce(
    (sum, vault) => sum + toSafeNumber(vault.targetAmount),
    0
  );
  const totalAllocated = vaults.reduce(
    (sum, vault) => sum + toSafeNumber(vault.allocatedAmount),
    0
  );

  return {
    summary: {
      totalTargetAmount: formatAmount(totalTarget),
      totalAllocatedAmount: formatAmount(totalAllocated),
      activeVaultCount: vaults.filter((vault) => vault.status === 'active').length,
      currency: 'MUSD',
    },
    vaults: serializedVaults,
  };
}

export async function createVault(user: AuthenticatedUser, input: CreateVaultInput) {
  const createdVault = await createTripVaultRecord({
    userId: user.id,
    name: input.name,
    targetAmount: input.targetAmount,
    note: input.note ?? null,
  });

  return {
    vault: serializeVault(createdVault),
  };
}

export async function getVaultById(user: AuthenticatedUser, id: string) {
  const vault = await findTripVaultByIdForUser(user.id, id);

  if (!vault) {
    throw new HttpError(404, 'Vault not found');
  }

  return {
    vault: serializeVault(vault),
  };
}
