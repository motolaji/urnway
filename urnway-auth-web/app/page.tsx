'use client';

import dynamic from 'next/dynamic';

const AuthScreen = dynamic(() => import('./auth-screen'), {
  ssr: false,
  loading: () => (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Urnway Auth Bridge</p>
        <h1>Preparing Passport auth...</h1>
        <p className="lede">
          Loading the client-only wallet bridge so Passport can connect, sign, and hand the
          payload back to mobile.
        </p>
      </section>
    </main>
  ),
});

export default function Page() {
  return <AuthScreen />;
}
