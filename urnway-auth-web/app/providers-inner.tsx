'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { useMemo, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { mezoTestnet, readPassportRuntimeConfig } from '@/lib/passport';

type ProvidersInnerProps = {
  children: ReactNode;
};

export function ProvidersInner({ children }: ProvidersInnerProps) {
  const runtimeConfig = useMemo(() => readPassportRuntimeConfig(), []);

  if (!runtimeConfig.ok) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Urnway Auth Bridge</p>
          <h1>WalletConnect setup is incomplete.</h1>
          <p className="lede">{runtimeConfig.error}</p>
        </section>

        <section className="panel">
          <div className="card">
            <div className="card-header">
              <h2>Required env</h2>
              <span className="badge badge-warning">setup needed</span>
            </div>
            <p>
              Add <code>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> to
              <code> .env.local </code> in <code>urnway-auth-web</code>, then restart the
              dev server.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const [queryClient] = useState(() => runtimeConfig.queryClient);

  return (
    <WagmiProvider config={runtimeConfig.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={mezoTestnet}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
