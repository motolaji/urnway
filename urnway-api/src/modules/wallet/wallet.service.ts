import {
  type Address,
  formatUnits,
  getAddress,
  parseAbi,
} from 'viem';

import { env } from '../../config/env.js';
import { mezoClient } from '../../lib/mezo.js';
import { HttpError } from '../../utils/http-error.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
};

type WalletTransaction = {
  id: string;
  type: 'receive' | 'send' | 'save' | 'borrow' | 'card';
  title: string;
  amount: string;
  currency: 'MUSD';
  direction: 'in' | 'out';
  status: 'completed';
  occurredAt: string;
  counterparty: string | null;
};

const TESTNET_MUSD_ADDRESS =
  '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as Address;
const MAINNET_MUSD_ADDRESS =
  '0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186' as Address;
export const DEFAULT_MEZO_BORROW_URL = 'https://mezo.org/feature/borrow';
export const NATIVE_TOKEN_DECIMALS = 18;
export const MUSD_TOKEN_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

function isoDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

export function getMusdTokenAddress() {
  if (env.MUSD_TOKEN_ADDRESS) {
    return getAddress(env.MUSD_TOKEN_ADDRESS);
  }

  return env.MEZO_CHAIN_ID === 31611 ? TESTNET_MUSD_ADDRESS : MAINNET_MUSD_ADDRESS;
}

export async function getWalletAssetSnapshot(walletAddress: string) {
  const normalizedWalletAddress = getAddress(walletAddress);
  const musdAddress = getMusdTokenAddress();
  const [nativeBalance, musdBalance, musdDecimals, musdSymbol] = await Promise.all([
    mezoClient.getBalance({
      address: normalizedWalletAddress,
    }),
    mezoClient.readContract({
      address: musdAddress,
      abi: MUSD_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [normalizedWalletAddress],
    }),
    mezoClient.readContract({
      address: musdAddress,
      abi: MUSD_TOKEN_ABI,
      functionName: 'decimals',
    }),
    mezoClient.readContract({
      address: musdAddress,
      abi: MUSD_TOKEN_ABI,
      functionName: 'symbol',
    }),
  ]);

  return {
    walletAddress: normalizedWalletAddress,
    musdAddress,
    nativeBalance,
    musdBalance,
    musdDecimals,
    musdSymbol,
  };
}

export async function getWalletBalance(user: AuthenticatedUser) {
  try {
    const snapshot = await getWalletAssetSnapshot(user.walletAddress);

    return {
      summary: {
        walletAddress: snapshot.walletAddress,
        nativeTokenBalance: formatUnits(
          snapshot.nativeBalance,
          NATIVE_TOKEN_DECIMALS
        ),
        nativeTokenSymbol: 'BTC',
        musdBalance: formatUnits(snapshot.musdBalance, snapshot.musdDecimals),
        musdTokenSymbol: snapshot.musdSymbol,
        source: 'mezo',
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    throw new HttpError(
      502,
      error instanceof Error
        ? error.message
        : 'Could not read Mezo wallet balances'
    );
  }
}

export function getWalletPosition() {
  return {
    position: {
      borrowProvider: 'Mezo',
      borrowUrl: DEFAULT_MEZO_BORROW_URL,
      minimumCollateralizationRatio: '110.00',
      source: 'mezo',
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getWalletTransactions(_user: AuthenticatedUser) {
  return {
    transactions: [] as WalletTransaction[],
    nextCursor: null,
    source: 'pending_indexer',
    updatedAt: isoDaysAgo(0),
  };
}
