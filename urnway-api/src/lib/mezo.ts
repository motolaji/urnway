import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { env } from '../config/env.js';

const explorerBaseUrl =
  env.MEZO_CHAIN_ID === 31611
    ? 'https://explorer.test.mezo.org'
    : 'https://explorer.mezo.org';

export const mezoChain = defineChain({
  id: env.MEZO_CHAIN_ID,
  name: env.MEZO_CHAIN_ID === 31611 ? 'Mezo Testnet' : 'Mezo',
  network: env.MEZO_CHAIN_ID === 31611 ? 'mezo-testnet' : 'mezo',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: {
      http: [env.MEZO_RPC_URL],
    },
    public: {
      http: [env.MEZO_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: env.MEZO_CHAIN_ID === 31611 ? 'Mezo Testnet Explorer' : 'Mezo Explorer',
      url: explorerBaseUrl,
    },
  },
  testnet: env.MEZO_CHAIN_ID === 31611,
});

export const mezoClient = createPublicClient({
  chain: mezoChain,
  transport: http(env.MEZO_RPC_URL),
});

export function buildMezoExplorerTxUrl(txHash: string) {
  return `${explorerBaseUrl}/tx/${txHash}`;
}

export function getTreasurySigner() {
  const privateKey = env.URNWAY_TREASURY_PRIVATE_KEY?.trim();

  if (!privateKey) {
    return null;
  }

  const normalizedPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;

  const account = privateKeyToAccount(normalizedPrivateKey as Hex);

  return {
    account,
    walletClient: createWalletClient({
      account,
      chain: mezoChain,
      transport: http(env.MEZO_RPC_URL),
    }),
  };
}
