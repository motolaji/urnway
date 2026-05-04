'use client';

import dynamic from 'next/dynamic';

const TxScreen = dynamic(() => import('./tx-screen'), {
  ssr: false,
  loading: () => (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Urnway Transaction Bridge</p>
        <h1>Preparing Passport transaction handoff...</h1>
        <p className="lede">
          Loading the client-only wallet bridge so Passport can submit the prepared MUSD
          transfer and return the transaction hash to mobile.
        </p>
      </section>
    </main>
  ),
});

export default function Page() {
  return <TxScreen />;
}
