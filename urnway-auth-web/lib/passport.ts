'use client';

import { QueryClient } from '@tanstack/react-query';
import { getConfig, mezoTestnet as passportMezoTestnet } from '@mezo-org/passport';
import type { Config } from 'wagmi';

import { prepareWalletBridgeSession } from '@/lib/wallet-session';

export type PassportRuntimeConfig =
  | {
      ok: true;
      wagmiConfig: Config;
      queryClient: QueryClient;
    }
  | {
      ok: false;
      error: string;
    };

const passportQueryClient = new QueryClient();
export const mezoTestnet = passportMezoTestnet;

export function readPassportRuntimeConfig(): PassportRuntimeConfig {
  prepareWalletBridgeSession();

  const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

  if (!walletConnectProjectId) {
    return {
      ok: false,
      error:
        'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing. Add your WalletConnect Cloud project id to .env.local before starting urnway-auth-web.',
    };
  }

  return {
    ok: true,
    wagmiConfig: getConfig({
      appName: 'Urnway Auth',
      mezoNetwork: 'testnet',
      walletConnectProjectId,
      chains: [mezoTestnet],
    }),
    queryClient: passportQueryClient,
  };
}
