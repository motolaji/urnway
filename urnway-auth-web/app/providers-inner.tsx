'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { useMemo, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { readPassportRuntimeConfig } from '@/lib/passport';

type ProvidersInnerProps = {
  children: ReactNode;
};

export function ProvidersInner({ children }: ProvidersInnerProps) {
  const runtimeConfig = useMemo(() => readPassportRuntimeConfig(), []);

  if (!runtimeConfig.ok) {
    return (
      <main className="bridge-shell">
        <section className="bridge-card">
          <div className="bridge-header">
            <p className="bridge-kicker">Urnway x Mezo Passport</p>
            <span className="badge badge-warning">setup needed</span>
          </div>
          <h1 className="bridge-title">WalletConnect setup is incomplete</h1>
          <p className="bridge-copy">{runtimeConfig.error}</p>
          <p className="muted bridge-muted">
            Add <code>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> to
            <code> .env.local </code> in <code>urnway-auth-web</code>, then restart the dev
            server.
          </p>
        </section>
      </main>
    );
  }

  const [queryClient] = useState(() => runtimeConfig.queryClient);

  return (
    <WagmiProvider config={runtimeConfig.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
