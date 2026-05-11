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
import { defineChain } from 'viem';
import { http } from 'wagmi';

import { prepareWalletBridgeSession } from '@/lib/wallet-session';

export type PassportRuntimeConfig =
  | {
      ok: true;
      wagmiConfig: ReturnType<typeof getDefaultConfig>;
      queryClient: QueryClient;
    }
  | {
      ok: false;
      error: string;
    };

const passportQueryClient = new QueryClient();

export const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  network: 'mezo-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    public: {
      http: ['https://rpc.test.mezo.org'],
      webSocket: ['wss://rpc-ws.test.mezo.org'],
    },
    default: {
      http: ['https://rpc.test.mezo.org'],
      webSocket: ['wss://rpc-ws.test.mezo.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Testnet Explorer',
      url: 'https://explorer.test.mezo.org',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 3669328,
    },
  },
  testnet: true,
});

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
