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

  // Get the mobile redirect URI for wallet callbacks
  const mobileRedirectUri = process.env.NEXT_PUBLIC_MOBILE_REDIRECT_URI?.trim();

  return {
    ok: true,
    wagmiConfig: getDefaultConfig({
      appName: 'Urnway',
      appDescription: 'Urnway Wallet Authentication',
      appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://urnway.com',
      appIcon: 'https://urnway.com/icon.png',
      projectId: walletConnectProjectId,
      chains: [mezoTestnet],
      wallets: walletList,
      transports: {
        [mezoTestnet.id]: http(mezoTestnet.rpcUrls.default.http[0]),
      },
      // WalletConnect metadata for redirect handling
      ...(mobileRedirectUri && {
        walletConnectParameters: {
          metadata: {
            name: 'Urnway',
            description: 'Urnway Wallet Authentication',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://urnway.com',
            icons: ['https://urnway.com/icon.png'],
            redirect: {
              native: mobileRedirectUri,
              universal: typeof window !== 'undefined' ? window.location.href : undefined,
            },
          },
        },
      }),
    }),
    queryClient: passportQueryClient,
  };
}
