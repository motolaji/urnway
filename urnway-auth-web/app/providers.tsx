'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

type ProvidersProps = {
  children: ReactNode;
};

const DynamicProviders = dynamic(
  () => import('./providers-inner').then((module) => module.ProvidersInner),
  {
    ssr: false,
  }
);

export function Providers({ children }: ProvidersProps) {
  return <DynamicProviders>{children}</DynamicProviders>;
}
