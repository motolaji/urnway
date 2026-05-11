'use client';

import dynamic from 'next/dynamic';

const AuthScreen = dynamic(() => import('./auth-screen'), {
  ssr: false,
  loading: () => (
    <main className="bridge-shell">
      <section className="bridge-card">
        <p className="bridge-kicker">Urnway x Mezo Passport</p>
        <h1 className="bridge-title">Preparing sign-in</h1>
        <p className="bridge-copy">Loading Passport.</p>
      </section>
    </main>
  ),
});

export default function Page() {
  return <AuthScreen />;
}
