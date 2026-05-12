'use client';

import { getDefaultConfig, type WalletList } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { QueryClient } from '@tanstack/react-query';
import {
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from '@mezo-org/passport/dist/src/config.js';
import { mezoTestnet as passportMezoTestnet } from '@mezo-org/passport/dist/src/constants.js';
import { http, type Config } from 'wagmi';

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

const walletList: WalletList = [
  {
    groupName: 'Bitcoin',
    wallets: [
      unisatWalletMezoTestnet,
      okxWalletMezoTestnet,
      xverseWalletMezoTestnet,
    ],
  },
  {
    groupName: 'Ethereum',
    wallets: [
      metaMaskWallet,
      trustWallet,
      coinbaseWallet,
      walletConnectWallet,
    ],
  },
];

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
    wagmiConfig: getDefaultConfig({
      appName: 'Urnway Auth',
      projectId: walletConnectProjectId,
      chains: [mezoTestnet],
      wallets: walletList,
      transports: {
        [mezoTestnet.id]: http(mezoTestnet.rpcUrls.default.http[0]),
      },
    }),
    queryClient: passportQueryClient,
  };
}
